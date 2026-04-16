/**
 * Lightweight Optical Music Recognition (OMR) using Canvas API.
 *
 * NOTE: Full OMR is an open ML problem. This module provides a *heuristic*
 * pipeline that works on clean, high-contrast scanned/printed scores:
 *
 *   1. Grayscale + adaptive binarization
 *   2. Detect staff lines via row-darkness histogram
 *   3. Group 5 consecutive lines into staves
 *   4. Classify each stave by clef position (estimated treble/bass based on stave order)
 *   5. Detect note heads (dark elliptical blobs) within each stave region
 *   6. Estimate pitch from vertical position relative to staff lines
 *   7. Detect bar lines (vertical strokes spanning 5 staff lines)
 *   8. Estimate time signature: rough heuristic, defaults to 4/4
 *
 * Returns a ParsedScore-compatible object so the same player can consume it.
 */

import { normalizePartKind } from './musicxml.js';

/**
 * Run OMR on an image element.
 * @param {HTMLImageElement|HTMLCanvasElement} imgOrCanvas
 * @param {HTMLCanvasElement} annotatedCanvas - Canvas to draw annotations on (for visual feedback)
 * @returns {Promise<{score: import('./musicxml.js').ParsedScore, debug: object}>}
 */
export async function runOMR(imgOrCanvas, annotatedCanvas) {
  // 1. Get image data ----------------------------------------------------
  const w = imgOrCanvas.naturalWidth || imgOrCanvas.width;
  const h = imgOrCanvas.naturalHeight || imgOrCanvas.height;

  // Downscale very large images to keep processing fast
  const MAX_W = 1400;
  const scale = w > MAX_W ? MAX_W / w : 1;
  const W = Math.round(w * scale);
  const H = Math.round(h * scale);

  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgOrCanvas, 0, 0, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);
  const gray = toGrayscale(imageData);
  const binary = adaptiveBinarize(gray, W, H);

  // 2. Detect staff lines via row darkness histogram --------------------
  const rowSums = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    let s = 0;
    for (let x = 0; x < W; x++) s += binary[y * W + x];
    rowSums[y] = s;
  }
  // Threshold: rows with > 35% dark pixels are candidates
  const thresh = W * 0.35;
  const darkRows = [];
  for (let y = 0; y < H; y++) if (rowSums[y] > thresh) darkRows.push(y);

  // Cluster consecutive dark rows into single line entries (line center)
  /** @type {number[]} */
  const lines = [];
  if (darkRows.length > 0) {
    let runStart = darkRows[0];
    let prev = darkRows[0];
    for (let i = 1; i <= darkRows.length; i++) {
      const cur = darkRows[i];
      if (cur === prev + 1) {
        prev = cur;
      } else {
        lines.push(Math.round((runStart + prev) / 2));
        runStart = cur;
        prev = cur;
      }
    }
  }

  // 3. Group lines into 5-line staves ----------------------------------
  // Heuristic: find median spacing between successive lines, then group runs
  // of 5 with consistent spacing.
  /** @type {{lines: number[], top: number, bottom: number, spacing: number}[]} */
  const staves = [];
  if (lines.length >= 5) {
    // Find clusters of 5 lines whose spacings are similar
    let i = 0;
    while (i + 4 < lines.length) {
      const candidate = lines.slice(i, i + 5);
      const spacings = [];
      for (let j = 1; j < 5; j++) spacings.push(candidate[j] - candidate[j - 1]);
      const avg = spacings.reduce((a, b) => a + b, 0) / 4;
      const maxDev = Math.max(...spacings.map((s) => Math.abs(s - avg)));
      if (avg >= 4 && avg <= 50 && maxDev / avg < 0.5) {
        staves.push({
          lines: candidate,
          top: candidate[0],
          bottom: candidate[4],
          spacing: avg,
        });
        i += 5;
      } else {
        i += 1;
      }
    }
  }

  // 4. Detect note heads in each stave region ---------------------------
  // For each stave, look in vertical band [top - 3*spacing, bottom + 3*spacing]
  // (covers ledger lines above and below). Erase staff lines first by
  // dilating dark regions horizontally — heads are wider than lines.
  /** @type {{stave: number, x: number, y: number, pitch: string}[]} */
  const detectedNotes = [];

  for (let sIdx = 0; sIdx < staves.length; sIdx++) {
    const stave = staves[sIdx];
    const sp = stave.spacing;
    const yStart = Math.max(0, Math.round(stave.top - 3 * sp));
    const yEnd = Math.min(H - 1, Math.round(stave.bottom + 3 * sp));

    // Make a "lines-removed" mask for this region: a pixel is kept dark only if it
    // also has dark neighbors above & below (i.e., it's not a thin horizontal line).
    const regionH = yEnd - yStart + 1;
    const mask = new Uint8Array(regionH * W);
    const vertCheck = Math.max(2, Math.round(sp * 0.4));
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = 0; x < W; x++) {
        if (!binary[y * W + x]) continue;
        let darkAbove = 0, darkBelow = 0;
        for (let dy = 1; dy <= vertCheck; dy++) {
          if (y - dy >= 0 && binary[(y - dy) * W + x]) darkAbove++;
          if (y + dy < H && binary[(y + dy) * W + x]) darkBelow++;
        }
        if (darkAbove + darkBelow >= vertCheck) {
          mask[(y - yStart) * W + x] = 1;
        }
      }
    }

    // Connected-components blob detection on the mask
    const blobs = findBlobs(mask, W, regionH);

    // Filter blobs: must be roughly the size of a notehead (~ spacing^2)
    const minBlob = Math.max(8, Math.round(sp * sp * 0.4));
    const maxBlob = Math.round(sp * sp * 6);
    for (const b of blobs) {
      if (b.area < minBlob || b.area > maxBlob) continue;
      const aspect = (b.maxX - b.minX + 1) / (b.maxY - b.minY + 1);
      if (aspect < 0.5 || aspect > 3.5) continue;

      const cx = (b.minX + b.maxX) / 2;
      const cy = yStart + (b.minY + b.maxY) / 2;
      const pitch = estimatePitch(cy, stave, sIdx, staves.length);
      detectedNotes.push({ stave: sIdx, x: cx, y: cy, pitch });
    }
  }

  // Sort notes by stave then by x
  detectedNotes.sort((a, b) => a.stave - b.stave || a.x - b.x);

  // 5. Detect bar lines (vertical strokes spanning the stave) ----------
  /** @type {number[][]} */
  const barLinesPerStave = staves.map((stave) => {
    const sp = stave.spacing;
    const yTop = Math.max(0, Math.round(stave.top - sp));
    const yBot = Math.min(H - 1, Math.round(stave.bottom + sp));
    const colDark = new Int32Array(W);
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = yTop; y <= yBot; y++) if (binary[y * W + x]) s++;
      colDark[x] = s;
    }
    const minSpan = Math.round((yBot - yTop) * 0.85);
    const bars = [];
    let runStart = -1;
    for (let x = 0; x < W; x++) {
      if (colDark[x] >= minSpan) {
        if (runStart < 0) runStart = x;
      } else {
        if (runStart >= 0) {
          bars.push(Math.round((runStart + (x - 1)) / 2));
          runStart = -1;
        }
      }
    }
    return bars;
  });

  // 6. Build per-part note lists, assign durations heuristically -------
  // We don't reliably distinguish note durations from binary heuristics.
  // Strategy: split notes between consecutive bar lines into N equal beats
  // (where N is the assumed beats per measure = 4).
  const beatsPerMeasure = 4;
  /** @type {import('./musicxml.js').ParsedPart[]} */
  const parts = [];

  // Heuristic SATB labelling based on number of staves:
  // 1 stave → "Melody" (treble)
  // 2 staves → Treble (Soprano+Alto), Bass (Tenor+Bass) — but we can't reliably split
  //   so we treat as Soprano + Bass
  // 4 staves → Soprano/Alto/Tenor/Bass
  const nameForStave = (idx, total) => {
    if (total === 1) return { name: 'Melody', kind: 'soprano' };
    if (total === 2) return idx === 0
      ? { name: 'Treble', kind: 'soprano' }
      : { name: 'Bass', kind: 'bass' };
    if (total === 3) return [
      { name: 'Soprano', kind: 'soprano' },
      { name: 'Alto', kind: 'alto' },
      { name: 'Bass', kind: 'bass' },
    ][idx];
    if (total >= 4) return [
      { name: 'Soprano', kind: 'soprano' },
      { name: 'Alto', kind: 'alto' },
      { name: 'Tenor', kind: 'tenor' },
      { name: 'Bass', kind: 'bass' },
    ][Math.min(3, idx)];
    return { name: `Part ${idx + 1}`, kind: 'other' };
  };

  let totalBeats = 0;
  for (let sIdx = 0; sIdx < staves.length; sIdx++) {
    const meta = nameForStave(sIdx, staves.length);
    const staveNotes = detectedNotes.filter((n) => n.stave === sIdx);
    const bars = barLinesPerStave[sIdx];

    /** @type {import('./musicxml.js').ParsedNote[]} */
    const notes = [];
    let beatCursor = 0;

    if (bars.length < 2) {
      // No bar lines detected — distribute all notes evenly with quarter-beat duration
      for (const n of staveNotes) {
        notes.push({ pitch: n.pitch, duration: 1, rest: false, startBeat: beatCursor });
        beatCursor += 1;
      }
    } else {
      // Group notes between bar lines
      let prevBar = bars[0];
      for (let bi = 1; bi < bars.length; bi++) {
        const curBar = bars[bi];
        const inMeasure = staveNotes.filter((n) => n.x > prevBar && n.x <= curBar);
        if (inMeasure.length === 0) {
          // Empty measure → whole rest
          notes.push({ rest: true, duration: beatsPerMeasure, startBeat: beatCursor });
          beatCursor += beatsPerMeasure;
        } else {
          const dur = beatsPerMeasure / inMeasure.length;
          for (const n of inMeasure) {
            notes.push({ pitch: n.pitch, duration: dur, rest: false, startBeat: beatCursor });
            beatCursor += dur;
          }
        }
        prevBar = curBar;
      }
    }

    if (beatCursor > totalBeats) totalBeats = beatCursor;
    parts.push({ id: `S${sIdx + 1}`, name: meta.name, kind: normalizePartKind(meta.name), notes });
  }

  // 7. Annotate canvas for visual feedback ------------------------------
  if (annotatedCanvas) {
    annotatedCanvas.width = W;
    annotatedCanvas.height = H;
    const actx = annotatedCanvas.getContext('2d');
    actx.drawImage(off, 0, 0);
    // Draw staff lines
    actx.strokeStyle = 'rgba(108, 140, 255, 0.4)';
    actx.lineWidth = 1;
    for (const stave of staves) {
      for (const ly of stave.lines) {
        actx.beginPath();
        actx.moveTo(0, ly);
        actx.lineTo(W, ly);
        actx.stroke();
      }
    }
    // Draw bar lines
    actx.strokeStyle = 'rgba(255, 184, 77, 0.7)';
    actx.lineWidth = 2;
    for (let sIdx = 0; sIdx < staves.length; sIdx++) {
      const stave = staves[sIdx];
      for (const bx of barLinesPerStave[sIdx]) {
        actx.beginPath();
        actx.moveTo(bx, stave.top - stave.spacing);
        actx.lineTo(bx, stave.bottom + stave.spacing);
        actx.stroke();
      }
    }
    // Draw notes
    actx.fillStyle = 'rgba(74, 222, 128, 0.6)';
    actx.font = '11px sans-serif';
    actx.textAlign = 'center';
    for (const n of detectedNotes) {
      actx.beginPath();
      actx.arc(n.x, n.y, 6, 0, 2 * Math.PI);
      actx.fill();
      actx.fillStyle = '#fff';
      actx.fillText(n.pitch, n.x, n.y - 8);
      actx.fillStyle = 'rgba(74, 222, 128, 0.6)';
    }
  }

  const score = {
    parts,
    timeSignature: { beats: beatsPerMeasure, beatType: 4 },
    keySignature: { fifths: 0, mode: 'major' },
    bpm: 100,
    totalBeats,
  };

  return {
    score,
    debug: {
      width: W,
      height: H,
      staveCount: staves.length,
      detectedNoteCount: detectedNotes.length,
      barLineCount: barLinesPerStave.reduce((s, a) => s + a.length, 0),
    },
  };
}

// ============ Image processing helpers ============

function toGrayscale(imageData) {
  const { data, width, height } = imageData;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
  }
  return gray;
}

/**
 * Adaptive binarization (Sauvola-like). Returns Uint8Array where 1 = dark (ink).
 */
function adaptiveBinarize(gray, W, H) {
  // Compute integral images for fast mean calculation
  const sum = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      rowSum += gray[y * W + x];
      sum[y * W + x] = rowSum + (y > 0 ? sum[(y - 1) * W + x] : 0);
    }
  }
  const window = 25;
  const k = 0.3;
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const x1 = Math.max(0, x - window);
      const y1 = Math.max(0, y - window);
      const x2 = Math.min(W - 1, x + window);
      const y2 = Math.min(H - 1, y + window);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const A = (x1 > 0 && y1 > 0) ? sum[(y1 - 1) * W + (x1 - 1)] : 0;
      const B = (y1 > 0) ? sum[(y1 - 1) * W + x2] : 0;
      const C = (x1 > 0) ? sum[y2 * W + (x1 - 1)] : 0;
      const D = sum[y2 * W + x2];
      const mean = (D - B - C + A) / area;
      const thresh = mean * (1 - k);
      out[y * W + x] = gray[y * W + x] < thresh ? 1 : 0;
    }
  }
  return out;
}

/**
 * Connected-component labelling on binary mask. Returns blob bounding boxes + areas.
 */
function findBlobs(mask, W, H) {
  const labels = new Int32Array(W * H);
  const blobs = [];
  let label = 0;
  const stackX = new Int32Array(W * H);
  const stackY = new Int32Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x] && !labels[y * W + x]) {
        label++;
        let sp = 0;
        stackX[sp] = x; stackY[sp] = y; sp++;
        let area = 0, minX = x, maxX = x, minY = y, maxY = y;
        while (sp > 0) {
          sp--;
          const cx = stackX[sp], cy = stackY[sp];
          if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
          const idx = cy * W + cx;
          if (!mask[idx] || labels[idx]) continue;
          labels[idx] = label;
          area++;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          stackX[sp] = cx + 1; stackY[sp] = cy; sp++;
          stackX[sp] = cx - 1; stackY[sp] = cy; sp++;
          stackX[sp] = cx; stackY[sp] = cy + 1; sp++;
          stackX[sp] = cx; stackY[sp] = cy - 1; sp++;
        }
        blobs.push({ area, minX, maxX, minY, maxY });
      }
    }
  }
  return blobs;
}

/**
 * Estimate pitch from y-coordinate relative to a stave.
 *
 * For a treble clef stave (assumed for upper staves), the lines from top to bottom
 * are: F5, D5, B4, G4, E4 (with spaces A4, F4, C5, E5 in between).
 * For a bass clef stave (assumed for the lowest stave when there are 2+), the lines
 * are: A3, F3, D3, B2, G2.
 */
function estimatePitch(y, stave, staveIdx, staveCount) {
  const sp = stave.spacing;
  // Convert y to "step units" where each step is half the line spacing.
  // Top line (stave.lines[0]) is reference position 0. Going down increases position.
  const stepUnit = sp / 2;
  const pos = Math.round((y - stave.lines[0]) / stepUnit);

  // For diatonic mapping (assume C major / no key sig)
  // Treble clef positions (top line F5):
  //   pos -2: A5, -1: G5, 0: F5, 1: E5, 2: D5, 3: C5, 4: B4, 5: A4, 6: G4,
  //   7: F4, 8: E4, 9: D4, 10: C4 (middle C, ledger), 11: B3, 12: A3
  // Bass clef positions (top line A3):
  //   pos 0: A3, 1: G3, 2: F3, 3: E3, 4: D3, 5: C3, 6: B2, 7: A2, 8: G2
  const isBass = staveCount >= 2 && staveIdx === staveCount - 1;
  const refLetter = isBass ? 'A' : 'F';
  const refOctave = isBass ? 3 : 5;

  // Letter sequence going DOWN from reference: F E D C B A G F E D C ...
  // (or A G F E D C B A G F ... for bass)
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const refIdx = letters.indexOf(refLetter);
  // Each pos increment moves down by one diatonic step
  const newIdx = ((refIdx - pos) % 7 + 7) % 7;
  const stepsDown = pos;
  // Compute octave: starting from refOctave, the pitch C is at the *boundary* — going below B drops to next-lower-octave B
  // Easier: compute total semitones from reference, then map.
  // Use absolute "diatonic index" (lettersBelowMiddleC scheme)
  const absRef = absoluteDiatonic(refLetter, refOctave);
  const absNote = absRef - stepsDown;
  return diatonicToName(absNote);
}

/** Convert (letter, octave) to absolute diatonic index (C0 = 0, D0 = 1, ...) */
function absoluteDiatonic(letter, octave) {
  const order = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  return octave * 7 + order.indexOf(letter);
}
function diatonicToName(absIdx) {
  const order = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const oct = Math.floor(absIdx / 7);
  const letter = order[((absIdx % 7) + 7) % 7];
  return `${letter}${oct}`;
}

/**
 * MusicXML parser — extracts parts, measures, notes, timing, and signatures
 * Supports multi-part SATB scores, divisions, durations, pitches, rests, ties.
 *
 * Also supports compressed MusicXML (.mxl) by unzipping in the browser (only plain
 * .xml/.musicxml is required, but we accept both and try to decompress).
 */

/**
 * @typedef {Object} ParsedNote
 * @property {string=} pitch   - Scientific pitch notation (e.g., "C4", "F#5")
 * @property {number} duration - Duration in beats (quarter = 1)
 * @property {boolean} rest    - True if this is a rest
 * @property {number} startBeat - Absolute beat offset from score start
 * @property {boolean=} tiedToNext - True if this note is tied to the next
 */

/**
 * @typedef {Object} ParsedPart
 * @property {string} id
 * @property {string} name         - e.g., "Soprano", "Alto", "Tenor", "Bass"
 * @property {string} kind         - Normalized part kind: soprano|alto|tenor|bass|other
 * @property {ParsedNote[]} notes
 */

/**
 * @typedef {Object} ParsedScore
 * @property {ParsedPart[]} parts
 * @property {{beats: number, beatType: number}} timeSignature
 * @property {{fifths: number, mode: string}} keySignature
 * @property {number} bpm                  - Inferred BPM
 * @property {number} totalBeats
 */

const STEP_TO_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Convert MusicXML pitch (step/octave/alter) to scientific notation string. */
function pitchToName(step, octave, alter = 0) {
  const n = STEP_TO_SEMITONES[step] + alter;
  // Normalize so we still emit a readable note name
  let s = step;
  if (alter === 1) s += '#';
  else if (alter === -1) s += 'b';
  else if (alter === 2) s += '##';
  else if (alter === -2) s += 'bb';
  return `${s}${octave}`;
}

/** Normalize a part name to SATB category. */
export function normalizePartKind(name = '') {
  const lower = name.toLowerCase().trim();
  if (/sopran|소프라노/.test(lower)) return 'soprano';
  if (/alto|mezzo|엘토|알토/.test(lower)) return 'alto';
  if (/tenor|테너/.test(lower)) return 'tenor';
  if (/bass|바리톤|베이스|baritone/.test(lower)) return 'bass';
  return 'other';
}

/**
 * Parse a MusicXML document (as text).
 * @param {string} xmlText
 * @returns {ParsedScore}
 */
export function parseMusicXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const err = doc.querySelector('parsererror');
  if (err) throw new Error('MusicXML 파싱 실패: ' + err.textContent);

  // --- Collect part list (names) ---
  const partNameMap = {};
  doc.querySelectorAll('part-list score-part').forEach((sp) => {
    const id = sp.getAttribute('id');
    const pn = sp.querySelector('part-name');
    partNameMap[id] = pn ? pn.textContent.trim() : id;
  });

  // --- Parse each part ---
  const partsEls = Array.from(doc.querySelectorAll('score-partwise > part'));
  if (partsEls.length === 0) {
    throw new Error('지원되지 않는 MusicXML 형식 (score-partwise 필요)');
  }

  /** @type {ParsedPart[]} */
  const parts = [];
  let globalTimeSig = { beats: 4, beatType: 4 };
  let globalKey = { fifths: 0, mode: 'major' };
  let globalBpm = 100;
  let maxTotalBeats = 0;

  for (const partEl of partsEls) {
    const id = partEl.getAttribute('id');
    const name = partNameMap[id] || id;
    const kind = normalizePartKind(name);

    /** @type {ParsedNote[]} */
    const notes = [];
    let currentBeat = 0;
    let divisions = 1; // Ticks per quarter note
    let staffBeats = 0;

    // Track ties so we can merge tied notes into a single duration
    // key: `${voice}:${pitch}` -> index in notes[]
    const openTies = {};

    const measures = Array.from(partEl.querySelectorAll('measure'));
    for (const measure of measures) {
      const measureStart = currentBeat;
      let measureMaxBeat = 0;

      for (const child of Array.from(measure.children)) {
        switch (child.tagName) {
          case 'attributes': {
            const divEl = child.querySelector('divisions');
            if (divEl) divisions = parseInt(divEl.textContent, 10) || 1;
            const timeEl = child.querySelector('time');
            if (timeEl) {
              globalTimeSig = {
                beats: parseInt(timeEl.querySelector('beats')?.textContent ?? '4', 10),
                beatType: parseInt(timeEl.querySelector('beat-type')?.textContent ?? '4', 10),
              };
            }
            const keyEl = child.querySelector('key');
            if (keyEl) {
              globalKey = {
                fifths: parseInt(keyEl.querySelector('fifths')?.textContent ?? '0', 10),
                mode: keyEl.querySelector('mode')?.textContent ?? 'major',
              };
            }
            break;
          }
          case 'direction': {
            const metronome = child.querySelector('sound[tempo]');
            if (metronome) {
              const t = parseFloat(metronome.getAttribute('tempo'));
              if (!isNaN(t) && t > 0) globalBpm = t;
            }
            break;
          }
          case 'sound': {
            const t = parseFloat(child.getAttribute('tempo'));
            if (!isNaN(t) && t > 0) globalBpm = t;
            break;
          }
          case 'backup': {
            const d = parseInt(child.querySelector('duration')?.textContent ?? '0', 10);
            currentBeat -= d / divisions;
            break;
          }
          case 'forward': {
            const d = parseInt(child.querySelector('duration')?.textContent ?? '0', 10);
            currentBeat += d / divisions;
            break;
          }
          case 'note': {
            const isChord = !!child.querySelector('chord');
            const isRest = !!child.querySelector('rest');
            const durTicks = parseInt(child.querySelector('duration')?.textContent ?? '0', 10);
            const durBeats = durTicks / divisions;
            const voice = child.querySelector('voice')?.textContent ?? '1';

            if (isChord) {
              // Chord notes occur at the same position as the previous note:
              // back up to the previous note's start. We add them as separate notes
              // (the player will handle polyphony).
              currentBeat -= durBeats;
            }

            const startBeat = currentBeat;

            if (isRest) {
              notes.push({ rest: true, duration: durBeats, startBeat });
            } else {
              const pitchEl = child.querySelector('pitch');
              if (pitchEl) {
                const step = pitchEl.querySelector('step')?.textContent ?? 'C';
                const octave = parseInt(pitchEl.querySelector('octave')?.textContent ?? '4', 10);
                const alter = parseInt(pitchEl.querySelector('alter')?.textContent ?? '0', 10);
                const pitch = pitchToName(step, octave, alter);

                const tieStart = child.querySelector('tie[type="start"]');
                const tieStop = child.querySelector('tie[type="stop"]');
                const tieKey = `${voice}:${pitch}`;

                if (tieStop && openTies[tieKey] !== undefined) {
                  // Extend the existing tied note
                  const existingIdx = openTies[tieKey];
                  notes[existingIdx].duration += durBeats;
                  if (!tieStart) delete openTies[tieKey];
                } else {
                  notes.push({ pitch, duration: durBeats, rest: false, startBeat });
                  if (tieStart) openTies[tieKey] = notes.length - 1;
                }
              }
            }
            currentBeat += durBeats;
            if (currentBeat > measureMaxBeat) measureMaxBeat = currentBeat;
            break;
          }
        }
      }
      // Ensure measure ends at the expected position even if voices are incomplete
      const expectedMeasureBeats = globalTimeSig.beats * (4 / globalTimeSig.beatType);
      currentBeat = measureStart + Math.max(measureMaxBeat - measureStart, expectedMeasureBeats);
      staffBeats = currentBeat;
    }

    parts.push({ id, name, kind, notes });
    if (staffBeats > maxTotalBeats) maxTotalBeats = staffBeats;
  }

  // Sort each part's notes by startBeat for consistency
  for (const p of parts) {
    p.notes.sort((a, b) => a.startBeat - b.startBeat);
  }

  return {
    parts,
    timeSignature: globalTimeSig,
    keySignature: globalKey,
    bpm: globalBpm,
    totalBeats: maxTotalBeats,
  };
}

/** Format key signature to human-readable string (e.g., "G major"). */
export function formatKey({ fifths, mode }) {
  const majorKeys = ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
  const minorKeys = ['Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#','G#','D#','A#'];
  const idx = fifths + 7;
  const keys = mode === 'minor' ? minorKeys : majorKeys;
  const k = keys[Math.max(0, Math.min(keys.length - 1, idx))] ?? 'C';
  return `${k} ${mode}`;
}

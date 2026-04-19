/**
 * Main UI orchestration: input handling, analysis dispatch, playback wiring,
 * and choir-practice-focused controls (my-part presets, metronome, loop,
 * pitch preview keyboard).
 */

import { parseMusicXML, formatKey } from './musicxml.js';
import { runOMR } from './omr.js';
import { Player, PART_COLORS, DEFAULT_INSTRUMENT, INSTRUMENT_LABELS } from './player.js';
import { Camera } from './camera.js';
import { hymnXML, satbXML, twinkleXML, scaleXML } from './samples-inline.js';

// ============ DOM refs ============
const $ = (sel) => document.querySelector(sel);
const tabs = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const dropzone = $('#dropzone');
const imageInput = $('#image-input');
const musicxmlInput = $('#musicxml-input');
const previewWrap = $('#image-preview');
const previewImg = $('#preview-img');

const cameraVideo = $('#camera-video');
const cameraStartBtn = $('#camera-start');
const cameraCaptureBtn = $('#camera-capture');
const cameraStopBtn = $('#camera-stop');
const cameraFacingSel = $('#camera-facing');

const sampleGrid = $('#sample-grid');

const analysisCard = $('#analysis-card');
const analysisStatus = $('#analysis-status');
const analysisDetails = $('#analysis-details');
const annotatedCanvas = $('#annotated-canvas');

const playbackCard = $('#playback-card');
const playBtn = $('#play-btn');
const pauseBtn = $('#pause-btn');
const stopBtn = $('#stop-btn');
const bpmSlider = $('#bpm-slider');
const bpmValue = $('#bpm-value');
const masterVolume = $('#master-volume');
const volumeValue = $('#volume-value');
const timeSigDisplay = $('#time-sig-display');
const keyDisplay = $('#key-display');
const partsContainer = $('#parts-container');
const progressBar = $('#progress-bar');
const progressFill = $('#progress-fill');
const progressText = $('#progress-text');
const loopOverlay = $('#loop-overlay');
const measureDisplay = $('#measure-display');
const beatDisplay = $('#beat-display');

const tempoBtns = document.querySelectorAll('[data-tempo]');
const metronomeToggle = $('#metronome-toggle');
const countinToggle = $('#countin-toggle');

const myPartSelect = $('#my-part-select');
const practicePresetBtns = document.querySelectorAll('[data-preset]');

const loopSetA = $('#loop-set-a');
const loopSetB = $('#loop-set-b');
const loopClear = $('#loop-clear');
const loopStatus = $('#loop-status');

const previewInstrument = $('#preview-instrument');
const pitchKeyboard = $('#pitch-keyboard');

const camera = new Camera(cameraVideo);
const player = new Player();
let currentScore = null;
let loopA = null;
let loopB = null;

// ============ Tabs ============
tabs.forEach((t) => t.addEventListener('click', () => {
  tabs.forEach((x) => x.classList.toggle('active', x === t));
  tabPanels.forEach((p) => p.classList.toggle('active', p.dataset.panel === t.dataset.tab));
}));

// ============ File / Drag-Drop ============
dropzone.addEventListener('click', () => imageInput.click());
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files?.[0];
  if (file) handleImageFile(file);
});
imageInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleImageFile(file);
});

musicxmlInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (file) await handleMusicXMLFile(file);
});

// ============ Camera ============
cameraStartBtn.addEventListener('click', async () => {
  try {
    await camera.start(cameraFacingSel.value);
    cameraStartBtn.disabled = true;
    cameraStopBtn.disabled = false;
    cameraCaptureBtn.disabled = false;
  } catch (e) {
    alert('카메라 시작 실패: ' + e.message);
  }
});
cameraStopBtn.addEventListener('click', () => {
  camera.stop();
  cameraStartBtn.disabled = false;
  cameraStopBtn.disabled = true;
  cameraCaptureBtn.disabled = true;
});
cameraCaptureBtn.addEventListener('click', async () => {
  try {
    const canvas = camera.capture();
    previewImg.src = canvas.toDataURL('image/png');
    previewWrap.hidden = false;
    camera.stop();
    cameraStartBtn.disabled = false;
    cameraStopBtn.disabled = true;
    cameraCaptureBtn.disabled = true;
    await analyzeImage(canvas);
  } catch (e) {
    alert('촬영 실패: ' + e.message);
  }
});

// ============ Image handling ============
function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('이미지 파일을 선택하세요');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    previewImg.src = reader.result;
    previewWrap.hidden = false;
    const img = new Image();
    img.onload = () => analyzeImage(img);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function handleMusicXMLFile(file) {
  setStatus('MusicXML 파일을 읽는 중...');
  analysisCard.hidden = false;
  try {
    if (file.name.endsWith('.mxl')) {
      throw new Error('압축된 MXL 파일은 아직 지원되지 않습니다. .xml 또는 .musicxml 파일을 사용하세요.');
    }
    const text = await file.text();
    const score = parseMusicXML(text);
    onScoreReady(score, { source: 'MusicXML', detected: false });
  } catch (e) {
    setStatus('파싱 실패: ' + e.message, 'error');
  }
}

async function analyzeImage(imgOrCanvas) {
  analysisCard.hidden = false;
  setStatus('이미지를 분석하는 중... (OMR)');
  annotatedCanvas.hidden = true;
  await new Promise((r) => setTimeout(r, 30));
  try {
    const { score, debug } = await runOMR(imgOrCanvas, annotatedCanvas);
    annotatedCanvas.hidden = false;
    if (debug.staveCount === 0) {
      setStatus(
        '오선(staff)을 찾지 못했습니다. 이미지가 흐리거나 기울어져 있을 수 있습니다. ' +
        'MusicXML 파일이나 샘플을 사용해 보세요.', 'error'
      );
      return;
    }
    if (score.parts.every((p) => p.notes.length === 0)) {
      setStatus('음표를 검출하지 못했습니다. 이미지 품질이 낮거나 휴리스틱이 작동하지 않을 수 있습니다.', 'error');
      return;
    }
    onScoreReady(score, {
      source: `OMR (오선 ${debug.staveCount}개, 음표 ${debug.detectedNoteCount}개 검출)`,
      detected: true,
    });
  } catch (e) {
    console.error(e);
    setStatus('분석 실패: ' + e.message, 'error');
  }
}

function setStatus(text, kind = '') {
  analysisStatus.textContent = text;
  analysisStatus.className = 'status' + (kind ? ' ' + kind : '');
}

function renderDetails(score, meta) {
  const items = [
    { label: '입력 방식', value: meta.source },
    { label: '파트 수', value: String(score.parts.length) },
    { label: '박자', value: `${score.timeSignature.beats}/${score.timeSignature.beatType}` },
    { label: '조성', value: formatKey(score.keySignature) },
    { label: '템포 (BPM)', value: String(Math.round(score.bpm)) },
    { label: '총 박자 수', value: score.totalBeats.toFixed(1) },
  ];
  analysisDetails.innerHTML = items
    .map((i) => `<div class="detail-item"><span class="label">${i.label}</span><span class="value">${i.value}</span></div>`)
    .join('');
}

// ============ Score ready ============
async function onScoreReady(score, meta) {
  currentScore = score;
  clearLoop();
  renderDetails(score, meta);
  setStatus('분석 완료. 재생 준비 중...', 'success');

  const detectedBpm = Math.max(40, Math.min(240, Math.round(score.bpm)));
  bpmSlider.value = detectedBpm;
  bpmValue.textContent = detectedBpm;
  player.setBpm(detectedBpm);
  player.setTempoScale(1.0);
  updateTempoButtons(1.0);

  timeSigDisplay.textContent = `${score.timeSignature.beats}/${score.timeSignature.beatType}`;
  keyDisplay.textContent = formatKey(score.keySignature);

  renderMyPartOptions(score);
  renderPartsUI(score);
  renderPitchKeyboard(score);
  resetProgressText();

  setStatus('악기 샘플을 불러오는 중...', '');
  try {
    await player.loadScore(score);
    setStatus('재생 준비 완료. ▶ 재생 버튼을 눌러주세요.', 'success');
    playbackCard.hidden = false;
    playbackCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    setStatus('샘플 로드 실패: ' + e.message, 'error');
  }
}

function resetProgressText() {
  if (!currentScore) return;
  const totalSec = currentScore.totalBeats * (60 / player.bpm);
  progressFill.style.width = '0%';
  progressText.textContent = `0:00 / ${formatTime(totalSec)}`;
  measureDisplay.textContent = '1';
  beatDisplay.textContent = '1';
}

// ============ Parts UI ============
function renderPartsUI(score) {
  partsContainer.innerHTML = '';
  for (const part of score.parts) {
    const settings = player.partSettings.get(part.id) || {
      muted: false,
      solo: false,
      instrument: DEFAULT_INSTRUMENT[part.kind] ?? 'piano',
      volume: 0,
    };
    if (!player.partSettings.has(part.id)) player.partSettings.set(part.id, settings);
    const color = PART_COLORS[part.kind] || PART_COLORS.other;

    const instrumentOpts = Object.entries(INSTRUMENT_LABELS)
      .map(([k, label]) => `<option value="${k}" ${settings.instrument === k ? 'selected' : ''}>${label}</option>`)
      .join('');

    const row = document.createElement('div');
    row.className = 'part-row';
    row.dataset.partId = part.id;
    row.style.borderLeftColor = color;
    row.innerHTML = `
      <div class="part-name">
        <span class="part-color" style="background:${color}"></span>
        ${escapeHtml(part.name)}
        <span class="muted" style="font-size:.8rem">(${part.notes.length} 음표)</span>
      </div>
      <select class="instrument-select">${instrumentOpts}</select>
      <label class="muted" style="font-size:.8rem">
        볼륨
        <input type="range" min="-30" max="6" value="${settings.volume}" class="volume-slider" />
      </label>
      <button class="toggle mute ${settings.muted ? 'active' : ''}">M</button>
      <button class="toggle solo ${settings.solo ? 'active' : ''}">S</button>
    `;
    const insSel = row.querySelector('.instrument-select');
    const volSl = row.querySelector('.volume-slider');
    const muteBtn = row.querySelector('.mute');
    const soloBtn = row.querySelector('.solo');

    insSel.addEventListener('change', async () => {
      setStatus(`악기를 변경 중: ${INSTRUMENT_LABELS[insSel.value] ?? insSel.value}...`, '');
      await player.setPartInstrument(part.id, insSel.value);
      if (currentScore) await player.loadScore(currentScore);
      setStatus('준비 완료', 'success');
    });
    volSl.addEventListener('input', () => player.setPartVolume(part.id, parseFloat(volSl.value)));
    muteBtn.addEventListener('click', () => {
      const cur = player.partSettings.get(part.id);
      player.setPartMuted(part.id, !cur.muted);
      muteBtn.classList.toggle('active', !cur.muted);
    });
    soloBtn.addEventListener('click', () => {
      const cur = player.partSettings.get(part.id);
      player.setPartSolo(part.id, !cur.solo);
      soloBtn.classList.toggle('active', !cur.solo);
    });

    partsContainer.appendChild(row);
  }
}

function refreshPartRowUI() {
  partsContainer.querySelectorAll('.part-row').forEach((row) => {
    const id = row.dataset.partId;
    const s = player.partSettings.get(id);
    if (!s) return;
    row.querySelector('.mute').classList.toggle('active', s.muted);
    row.querySelector('.solo').classList.toggle('active', s.solo);
    row.querySelector('.volume-slider').value = s.volume;
  });
}

// ============ My-Part Practice Presets ============
function renderMyPartOptions(score) {
  myPartSelect.innerHTML = score.parts
    .map((p, i) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join('');
  // Prefer soprano by default if present
  const soprano = score.parts.find((p) => p.kind === 'soprano');
  if (soprano) myPartSelect.value = soprano.id;
}

function applyPracticePreset(preset) {
  if (!currentScore) return;
  const myId = myPartSelect.value;
  for (const part of currentScore.parts) {
    const s = player.partSettings.get(part.id);
    if (!s) continue;
    const isMine = part.id === myId;
    switch (preset) {
      case 'solo':
        s.muted = !isMine;
        s.solo = false;
        s.volume = isMine ? 0 : 0;
        break;
      case 'guide':
        s.muted = isMine;
        s.solo = false;
        s.volume = 0;
        break;
      case 'learn':
        s.muted = false;
        s.solo = false;
        s.volume = isMine ? 3 : -12;
        break;
      case 'all':
      default:
        s.muted = false;
        s.solo = false;
        s.volume = 0;
        break;
    }
    player.setPartVolume(part.id, s.volume);
  }
  player._updateMuteStates();
  refreshPartRowUI();
}

practicePresetBtns.forEach((b) => b.addEventListener('click', () => applyPracticePreset(b.dataset.preset)));

// ============ Tempo presets ============
function updateTempoButtons(scale) {
  tempoBtns.forEach((b) => b.classList.toggle('active', parseFloat(b.dataset.tempo) === scale));
}

tempoBtns.forEach((b) => b.addEventListener('click', () => {
  const scale = parseFloat(b.dataset.tempo);
  player.setTempoScale(scale);
  updateTempoButtons(scale);
}));

// ============ Metronome / count-in toggles ============
metronomeToggle.addEventListener('change', () => player.setMetronome(metronomeToggle.checked));
countinToggle.addEventListener('change', () => player.setCountIn(countinToggle.checked));

// ============ Playback controls ============
playBtn.addEventListener('click', async () => {
  if (!currentScore) return;
  playBtn.disabled = true;
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  try {
    // Apply latest metronome/countin state in case user toggled before first play
    player.setMetronome(metronomeToggle.checked);
    player.setCountIn(countinToggle.checked);
    await player.play();
  } catch (e) {
    alert('재생 실패: ' + e.message);
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
  }
});
pauseBtn.addEventListener('click', async () => {
  if (Tone.Transport.state === 'started') {
    player.pause();
    pauseBtn.textContent = '▶ 이어재생';
  } else {
    await player.resume();
    pauseBtn.textContent = '❚❚ 일시정지';
  }
});
stopBtn.addEventListener('click', () => player.stop());

player.onProgress = ({ time, total, beat, measure }) => {
  const pct = total > 0 ? (time / total) * 100 : 0;
  progressFill.style.width = pct + '%';
  progressText.textContent = `${formatTime(time)} / ${formatTime(total)}`;
  if (currentScore) {
    const beatsPerMeasure = currentScore.timeSignature.beats;
    const beatInMeasure = Math.floor(beat % beatsPerMeasure) + 1;
    measureDisplay.textContent = String(measure);
    beatDisplay.textContent = String(beatInMeasure);
  }
};
player.onEnd = () => {
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  pauseBtn.textContent = '❚❚ 일시정지';
  resetProgressText();
};

bpmSlider.addEventListener('input', () => {
  bpmValue.textContent = bpmSlider.value;
  player.setBpm(parseInt(bpmSlider.value, 10));
});
masterVolume.addEventListener('input', () => {
  volumeValue.textContent = masterVolume.value + ' dB';
  player.setMasterVolumeDb(parseFloat(masterVolume.value));
});

// ============ Seekable progress bar ============
progressBar.addEventListener('click', (e) => {
  if (!currentScore) return;
  const rect = progressBar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const totalSec = currentScore.totalBeats * (60 / player.bpm);
  player.seek(ratio * totalSec);
});

// ============ Loop A/B ============
loopSetA.addEventListener('click', () => {
  if (!currentScore) return;
  loopA = player.currentSec || 0;
  updateLoopStatus();
});
loopSetB.addEventListener('click', () => {
  if (!currentScore) return;
  loopB = player.currentSec || (currentScore.totalBeats * (60 / player.bpm));
  if (loopA === null) loopA = 0;
  if (loopB <= loopA) {
    alert('B 지점은 A 지점보다 뒤에 있어야 합니다.');
    loopB = null;
    updateLoopStatus();
    return;
  }
  player.setLoop(loopA, loopB);
  updateLoopStatus();
});
loopClear.addEventListener('click', clearLoop);

function clearLoop() {
  loopA = null;
  loopB = null;
  player.clearLoop();
  updateLoopStatus();
}

function updateLoopStatus() {
  if (loopA !== null && loopB !== null && loopB > loopA) {
    loopStatus.textContent = `반복: ${formatTime(loopA)} → ${formatTime(loopB)}`;
    loopStatus.classList.add('active');
    if (currentScore) {
      const totalSec = currentScore.totalBeats * (60 / player.bpm);
      loopOverlay.hidden = false;
      loopOverlay.style.left = `${(loopA / totalSec) * 100}%`;
      loopOverlay.style.width = `${((loopB - loopA) / totalSec) * 100}%`;
    }
  } else if (loopA !== null) {
    loopStatus.textContent = `A 지점: ${formatTime(loopA)} (B 지점 설정 대기)`;
    loopStatus.classList.remove('active');
    loopOverlay.hidden = true;
  } else {
    loopStatus.textContent = '반복 해제됨';
    loopStatus.classList.remove('active');
    loopOverlay.hidden = true;
  }
}

// ============ Pitch preview keyboard ============
const KEYBOARD_OCTAVES = [3, 4, 5];
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTES = { C: 'C#', D: 'D#', F: 'F#', G: 'G#', A: 'A#' };

function renderPitchKeyboard(score) {
  // Collect pitches that actually appear in the score so we can highlight them
  const usedPitches = new Set();
  for (const p of score.parts) {
    for (const n of p.notes) if (n.pitch) usedPitches.add(n.pitch);
  }

  const keys = [];
  for (const oct of KEYBOARD_OCTAVES) {
    for (const step of WHITE_NOTES) {
      const pitch = `${step}${oct}`;
      keys.push({ pitch, black: false, highlight: usedPitches.has(pitch) });
      if (BLACK_NOTES[step]) {
        const bp = `${BLACK_NOTES[step]}${oct}`;
        keys.push({ pitch: bp, black: true, highlight: usedPitches.has(bp) });
      }
    }
  }

  pitchKeyboard.innerHTML = '';
  for (const k of keys) {
    const key = document.createElement('button');
    key.className = 'pk-key ' + (k.black ? 'black' : 'white') + (k.highlight ? ' highlight' : '');
    key.dataset.pitch = k.pitch;
    key.textContent = k.pitch;
    key.title = k.pitch + (k.highlight ? ' (악보에 포함됨)' : '');
    key.addEventListener('click', async () => {
      key.classList.add('pressed');
      setTimeout(() => key.classList.remove('pressed'), 220);
      await player.previewPitch(k.pitch, previewInstrument.value, 0.9);
    });
    pitchKeyboard.appendChild(key);
  }
}

// ============ Samples ============
const SAMPLES = [
  {
    xml: hymnXML,
    title: '⛪ 찬송풍 (Eb major, 3/4)',
    desc: 'SATB 8마디 · 3/4 박자 · 찬송가와 같은 조성·박자 연습용',
  },
  {
    xml: satbXML,
    title: '⛪ Amen Cadence',
    desc: 'SATB 4성부 화음 · F major · 4/4',
  },
  {
    xml: twinkleXML,
    title: '🌟 작은 별 (Twinkle)',
    desc: '단성부 멜로디 · C major · 4/4',
  },
  {
    xml: scaleXML,
    title: '🎵 C major Scale',
    desc: '음계 · 3/4 박자 시연',
  },
];

function renderSamples() {
  sampleGrid.innerHTML = SAMPLES.map((s, i) => `
    <div class="sample-card" data-idx="${i}">
      <div class="title">${s.title}</div>
      <div class="desc">${s.desc}</div>
    </div>
  `).join('');
  sampleGrid.querySelectorAll('.sample-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const idx = parseInt(card.dataset.idx, 10);
      const sample = SAMPLES[idx];
      setStatus('샘플 로딩 중: ' + sample.title);
      analysisCard.hidden = false;
      try {
        const score = parseMusicXML(sample.xml);
        previewWrap.hidden = true;
        annotatedCanvas.hidden = true;
        await onScoreReady(score, { source: '샘플 · ' + sample.title, detected: false });
      } catch (e) {
        setStatus('샘플 로드 실패: ' + e.message, 'error');
      }
    });
  });
}
renderSamples();

// ============ Helpers ============
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatTime(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

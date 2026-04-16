/**
 * Main UI orchestration: input handling, analysis dispatch, playback wiring.
 */

import { parseMusicXML, formatKey } from './musicxml.js';
import { runOMR } from './omr.js';
import { Player, PART_COLORS, DEFAULT_INSTRUMENT } from './player.js';
import { Camera } from './camera.js';

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
const stopBtn = $('#stop-btn');
const bpmSlider = $('#bpm-slider');
const bpmValue = $('#bpm-value');
const masterVolume = $('#master-volume');
const volumeValue = $('#volume-value');
const timeSigDisplay = $('#time-sig-display');
const keyDisplay = $('#key-display');
const partsContainer = $('#parts-container');
const progressFill = $('#progress-fill');
const progressText = $('#progress-text');

const camera = new Camera(cameraVideo);
const player = new Player();
let currentScore = null;

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
    // Wait for image to load before OMR
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
    let text;
    if (file.name.endsWith('.mxl')) {
      throw new Error('압축된 MXL 파일은 아직 지원되지 않습니다. .xml 또는 .musicxml 파일을 사용하세요.');
    } else {
      text = await file.text();
    }
    const score = parseMusicXML(text);
    onScoreReady(score, { source: 'MusicXML', detected: false });
  } catch (e) {
    setStatus('파싱 실패: ' + e.message, 'error');
  }
}

// ============ Analyze image (OMR) ============
async function analyzeImage(imgOrCanvas) {
  analysisCard.hidden = false;
  setStatus('이미지를 분석하는 중... (OMR)');
  annotatedCanvas.hidden = true;
  // Yield to browser so the status renders first
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

// ============ Status / details ============
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
  renderDetails(score, meta);
  setStatus('분석 완료. 재생 준비 중...', 'success');

  // Update playback UI with detected values
  const detectedBpm = Math.max(40, Math.min(240, Math.round(score.bpm)));
  bpmSlider.value = detectedBpm;
  bpmValue.textContent = detectedBpm;
  player.setBpm(detectedBpm);

  timeSigDisplay.textContent = `${score.timeSignature.beats}/${score.timeSignature.beatType}`;
  keyDisplay.textContent = formatKey(score.keySignature);

  renderPartsUI(score);

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

    const row = document.createElement('div');
    row.className = 'part-row';
    row.style.borderLeftColor = color;
    row.innerHTML = `
      <div class="part-name">
        <span class="part-color" style="background:${color}"></span>
        ${escapeHtml(part.name)}
        <span class="muted" style="font-size:.8rem">(${part.notes.length} 음표)</span>
      </div>
      <select class="instrument-select">
        <option value="piano" ${settings.instrument === 'piano' ? 'selected' : ''}>🎹 피아노</option>
        <option value="cello" ${settings.instrument === 'cello' ? 'selected' : ''}>🎻 첼로</option>
        <option value="violin" ${settings.instrument === 'violin' ? 'selected' : ''}>🎻 바이올린</option>
      </select>
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
      setStatus(`악기를 변경 중: ${insSel.value}...`, '');
      await player.setPartInstrument(part.id, insSel.value);
      // Re-load score so playback uses new instrument next play
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

// ============ Playback controls ============
playBtn.addEventListener('click', async () => {
  if (!currentScore) return;
  playBtn.disabled = true;
  stopBtn.disabled = false;
  try {
    await player.play();
  } catch (e) {
    alert('재생 실패: ' + e.message);
    playBtn.disabled = false;
    stopBtn.disabled = true;
  }
});
stopBtn.addEventListener('click', () => player.stop());

player.onProgress = ({ time, total }) => {
  const pct = total > 0 ? (time / total) * 100 : 0;
  progressFill.style.width = pct + '%';
  progressText.textContent = `${formatTime(time)} / ${formatTime(total)}`;
};
player.onEnd = () => {
  playBtn.disabled = false;
  stopBtn.disabled = true;
  progressFill.style.width = '0%';
  if (currentScore) {
    const totalSec = currentScore.totalBeats * (60 / player.bpm);
    progressText.textContent = `0:00 / ${formatTime(totalSec)}`;
  }
};

bpmSlider.addEventListener('input', () => {
  bpmValue.textContent = bpmSlider.value;
  player.setBpm(parseInt(bpmSlider.value, 10));
});
masterVolume.addEventListener('input', () => {
  volumeValue.textContent = masterVolume.value + ' dB';
  player.setMasterVolumeDb(parseFloat(masterVolume.value));
});

// ============ Samples ============
const SAMPLES = [
  {
    file: 'samples/twinkle.musicxml',
    title: '🌟 작은 별 (Twinkle)',
    desc: '단성부 멜로디 - C major, 4/4',
  },
  {
    file: 'samples/satb-amen.musicxml',
    title: '⛪ Amen Cadence',
    desc: 'SATB 4성부 화음 - F major, 4/4',
  },
  {
    file: 'samples/scale-3-4.musicxml',
    title: '🎵 C major Scale (3/4)',
    desc: '음계 - 3/4 박자 시연',
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
        const res = await fetch(sample.file);
        if (!res.ok) throw new Error('샘플 파일을 찾을 수 없습니다');
        const text = await res.text();
        const score = parseMusicXML(text);
        previewWrap.hidden = true;
        annotatedCanvas.hidden = true;
        await onScoreReady(score, { source: '샘플 (' + sample.title + ')', detected: false });
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

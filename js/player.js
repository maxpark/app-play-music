/**
 * Audio playback for parsed scores using Tone.js.
 *
 * Each part can be assigned its own instrument (piano / cello / violin / voice)
 * and routed through an independent gain channel for mute / solo / volume control.
 *
 * Sampler-based instruments pull CC-licensed soundfonts from tonejs-instruments.
 * The "voice" instrument is a layered PolySynth approximating an "아~" choir tone.
 */

const SAMPLE_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples';

const INSTRUMENT_SAMPLES = {
  piano: {
    url: `${SAMPLE_BASE}/piano/`,
    files: {
      A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
      A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
      A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
      A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
      A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
      A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
      A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
      A7: 'A7.mp3', C8: 'C8.mp3',
    },
  },
  cello: {
    url: `${SAMPLE_BASE}/cello/`,
    files: {
      C2: 'C2.mp3', E2: 'E2.mp3', G2: 'G2.mp3', B2: 'B2.mp3',
      C3: 'C3.mp3', E3: 'E3.mp3', G3: 'G3.mp3', B3: 'B3.mp3',
      C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', B4: 'B4.mp3',
      C5: 'C5.mp3', E5: 'E5.mp3',
    },
  },
  violin: {
    url: `${SAMPLE_BASE}/violin/`,
    files: {
      G3: 'G3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', E4: 'E4.mp3',
      G4: 'G4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', E5: 'E5.mp3',
      G5: 'G5.mp3', A5: 'A5.mp3', C6: 'C6.mp3', E6: 'E6.mp3',
    },
  },
};

export const PART_COLORS = {
  soprano: '#f87171',
  alto: '#facc15',
  tenor: '#4ade80',
  bass: '#60a5fa',
  other: '#c084fc',
};

export const DEFAULT_INSTRUMENT = {
  soprano: 'violin',
  alto: 'violin',
  tenor: 'cello',
  bass: 'cello',
  other: 'piano',
};

export const INSTRUMENT_LABELS = {
  piano: '🎹 피아노',
  cello: '🎻 첼로',
  violin: '🎻 바이올린',
  voice: '🗣️ 보컬(합성)',
};

/**
 * Build a synth-based "voice" instrument — a PolySynth that vaguely resembles
 * a choir "아~" vowel. Returned object exposes the same triggerAttackRelease /
 * connect API as a Tone.Sampler so callers can use them interchangeably.
 */
function buildVoiceSynth() {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsine', count: 3, spread: 25 },
    envelope: { attack: 0.12, decay: 0.2, sustain: 0.75, release: 0.7 },
  });
}

export class Player {
  constructor() {
    this.samplers = {};
    this.samplerLoaders = {};
    this.tracks = [];
    this.masterGain = null;
    this.score = null;
    this.bpm = 100;
    this.tempoScale = 1.0;
    this.partSettings = new Map();

    // Metronome / count-in state
    this.metronome = null;
    this.metronomeEnabled = false;
    this.countInEnabled = true;
    this._metronomeEvents = [];

    // Loop state
    this.loopEnabled = false;
    this.loopStartSec = 0;
    this.loopEndSec = 0;

    // Playback-time state
    this._startOffsetSec = 0; // where the transport was positioned at last play()
    this._playbackAbsoluteStart = 0; // Tone.now() when audible playback began

    this.onProgress = null;
    this.onEnd = null;
    this._progressInterval = null;
  }

  /** Lazy-load an instrument. Returns an object with triggerAttackRelease / connect. */
  async loadInstrument(name) {
    if (this.samplers[name]) return this.samplers[name];
    if (this.samplerLoaders[name]) return this.samplerLoaders[name];

    if (name === 'voice') {
      this.samplerLoaders[name] = Promise.resolve().then(() => {
        const s = buildVoiceSynth();
        this.samplers[name] = s;
        return s;
      });
      return this.samplerLoaders[name];
    }

    const cfg = INSTRUMENT_SAMPLES[name];
    if (!cfg) throw new Error(`Unknown instrument: ${name}`);
    this.samplerLoaders[name] = new Promise((resolve, reject) => {
      const sampler = new Tone.Sampler({
        urls: cfg.files,
        baseUrl: cfg.url,
        release: 1.2,
        onload: () => {
          this.samplers[name] = sampler;
          resolve(sampler);
        },
        onerror: (e) => {
          delete this.samplerLoaders[name];
          reject(e);
        },
      });
    });
    return this.samplerLoaders[name];
  }

  async init() {
    await Tone.start();
    if (!this.masterGain) {
      this.masterGain = new Tone.Gain(Tone.dbToGain(-6)).toDestination();
    }
    if (!this.metronome) {
      this.metronome = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
      });
      this.metronome.volume.value = -10;
      this.metronome.toDestination();
    }
  }

  setMasterVolumeDb(db) {
    if (this.masterGain) this.masterGain.gain.value = Tone.dbToGain(db);
  }

  setBpm(bpm) {
    this.bpm = bpm;
    Tone.Transport.bpm.value = bpm * this.tempoScale;
  }

  /** Apply a multiplier to the detected BPM (e.g., 0.5 for half-speed practice). */
  setTempoScale(scale) {
    this.tempoScale = scale;
    Tone.Transport.bpm.value = this.bpm * this.tempoScale;
  }

  setMetronome(enabled) {
    this.metronomeEnabled = enabled;
    // Mute already-scheduled metronome events if turning off mid-play
    for (const ev of this._metronomeEvents) ev.mute = !enabled;
  }

  setCountIn(enabled) {
    this.countInEnabled = enabled;
  }

  setLoop(startSec, endSec) {
    this.loopEnabled = true;
    this.loopStartSec = startSec;
    this.loopEndSec = endSec;
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = startSec;
    Tone.Transport.loopEnd = endSec;
  }

  clearLoop() {
    this.loopEnabled = false;
    Tone.Transport.loop = false;
  }

  /** Jump to a position within the score (seconds, in score time). */
  seek(sec) {
    if (!this.score) return;
    const total = this.score.totalBeats * (60 / this.bpm);
    const clamped = Math.max(0, Math.min(total, sec));
    Tone.Transport.seconds = clamped;
  }

  /** Current playback position in score-time seconds. */
  get currentSec() {
    return Tone.Transport.seconds;
  }

  async loadScore(score) {
    this.stop();
    this.score = score;
    for (const part of score.parts) {
      if (!this.partSettings.has(part.id)) {
        this.partSettings.set(part.id, {
          muted: false,
          solo: false,
          instrument: DEFAULT_INSTRUMENT[part.kind] ?? 'piano',
          volume: 0,
        });
      }
    }
    const insSet = new Set();
    for (const part of score.parts) insSet.add(this.partSettings.get(part.id).instrument);
    await Promise.all([...insSet].map((i) => this.loadInstrument(i)));
  }

  setPartInstrument(partId, instrument) {
    const s = this.partSettings.get(partId);
    if (s) s.instrument = instrument;
    return this.loadInstrument(instrument);
  }

  setPartMuted(partId, muted) {
    const s = this.partSettings.get(partId);
    if (s) s.muted = muted;
    this._updateMuteStates();
  }

  setPartSolo(partId, solo) {
    const s = this.partSettings.get(partId);
    if (s) s.solo = solo;
    this._updateMuteStates();
  }

  setPartVolume(partId, db) {
    const s = this.partSettings.get(partId);
    if (s) {
      s.volume = db;
      const tr = this.tracks.find((t) => t.partId === partId);
      if (tr) tr.channel.volume.value = db;
    }
  }

  _updateMuteStates() {
    const anySolo = [...this.partSettings.values()].some((s) => s.solo);
    for (const tr of this.tracks) {
      const s = this.partSettings.get(tr.partId);
      if (!s) continue;
      const audible = anySolo ? s.solo : !s.muted;
      tr.channel.mute = !audible;
    }
  }

  /**
   * Preview a single pitch on the given instrument. Used by the pitch keyboard
   * so users can listen to individual notes without starting full playback.
   */
  async previewPitch(pitch, instrumentName = 'piano', durationSec = 0.8) {
    await this.init();
    const inst = await this.loadInstrument(instrumentName);
    try {
      inst.triggerAttackRelease(pitch, durationSec);
    } catch (e) {
      console.warn('previewPitch failed', pitch, e.message);
    }
  }

  async play() {
    if (!this.score) return;
    await this.init();

    Tone.Transport.stop();
    Tone.Transport.cancel();
    this._teardownTracks();

    const beatSec = 60 / this.bpm;

    for (const part of this.score.parts) {
      const settings = this.partSettings.get(part.id);
      const instrument = await this.loadInstrument(settings.instrument);
      const channel = new Tone.Volume(settings.volume).connect(this.masterGain);
      instrument.connect(channel);

      const events = [];
      for (const note of part.notes) {
        if (note.rest || !note.pitch) continue;
        events.push({
          time: note.startBeat * beatSec,
          duration: note.duration * beatSec,
          pitch: note.pitch,
        });
      }

      const tonePart = new Tone.Part((time, ev) => {
        try {
          instrument.triggerAttackRelease(ev.pitch, Math.max(0.05, ev.duration), time);
        } catch (e) {
          console.warn('Skipping note', ev.pitch, e.message);
        }
      }, events.map((e) => [e.time, e]));
      tonePart.start(0);

      this.tracks.push({ partId: part.id, instrument, channel, tonePart });
    }

    this._scheduleMetronome(beatSec);
    this._updateMuteStates();

    const totalSec = this.score.totalBeats * beatSec;

    if (this.loopEnabled) {
      Tone.Transport.loop = true;
      Tone.Transport.loopStart = this.loopStartSec;
      Tone.Transport.loopEnd = this.loopEndSec;
    } else {
      Tone.Transport.loop = false;
      Tone.Transport.scheduleOnce(() => this.stop(), totalSec + 1.2);
    }

    // Count-in: play one measure of metronome clicks before transport starts.
    let startTime;
    if (this.countInEnabled) {
      const measureBeats = this.score.timeSignature?.beats ?? 4;
      const leadSec = 0.1;
      startTime = Tone.now() + leadSec;
      for (let i = 0; i < measureBeats; i++) {
        const note = i === 0 ? 'C6' : 'G5';
        this.metronome.triggerAttackRelease(note, '16n', startTime + i * beatSec);
      }
      const transportStart = startTime + measureBeats * beatSec;
      Tone.Transport.position = 0;
      Tone.Transport.start(transportStart);
      this._playbackAbsoluteStart = transportStart;
    } else {
      startTime = Tone.now() + 0.05;
      Tone.Transport.position = 0;
      Tone.Transport.start(startTime);
      this._playbackAbsoluteStart = startTime;
    }
    this._startOffsetSec = 0;

    if (this._progressInterval) clearInterval(this._progressInterval);
    this._progressInterval = setInterval(() => {
      if (this.onProgress) {
        const t = Math.min(Tone.Transport.seconds, totalSec);
        this.onProgress({
          time: t,
          total: totalSec,
          beat: t / beatSec,
          measure: this._beatToMeasure(t / beatSec),
        });
      }
    }, 100);
  }

  /** Resume playback from the current transport position (no count-in). */
  async resume() {
    if (!this.score) return;
    await this.init();
    if (Tone.Transport.state === 'started') return;
    Tone.Transport.start();
  }

  pause() {
    if (Tone.Transport.state === 'started') Tone.Transport.pause();
  }

  _scheduleMetronome(beatSec) {
    // Wipe any previous scheduled clicks
    for (const ev of this._metronomeEvents) {
      try { ev.stop(); ev.dispose(); } catch {}
    }
    this._metronomeEvents = [];
    if (!this.score) return;
    const beatsPerMeasure = this.score.timeSignature?.beats ?? 4;
    const totalBeats = Math.ceil(this.score.totalBeats);
    for (let b = 0; b < totalBeats; b++) {
      const isDownbeat = b % beatsPerMeasure === 0;
      const evTime = b * beatSec;
      const ev = new Tone.ToneEvent((time) => {
        if (!this.metronome) return;
        this.metronome.triggerAttackRelease(isDownbeat ? 'C6' : 'G5', '32n', time);
      });
      ev.mute = !this.metronomeEnabled;
      ev.start(evTime);
      this._metronomeEvents.push(ev);
    }
  }

  _beatToMeasure(beat) {
    const bpm = this.score?.timeSignature?.beats ?? 4;
    return Math.floor(beat / bpm) + 1;
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
    for (const ev of this._metronomeEvents) {
      try { ev.stop(); ev.dispose(); } catch {}
    }
    this._metronomeEvents = [];
    this._teardownTracks();
    if (this.onEnd) this.onEnd();
  }

  _teardownTracks() {
    for (const tr of this.tracks) {
      try { tr.tonePart.stop(); tr.tonePart.dispose(); } catch {}
      try { tr.instrument.disconnect(tr.channel); } catch {}
      try { tr.channel.dispose(); } catch {}
    }
    this.tracks = [];
  }
}

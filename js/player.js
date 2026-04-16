/**
 * Audio playback for parsed scores using Tone.js.
 *
 * Each part can be assigned its own instrument (piano / cello / violin) and
 * routed through an independent gain channel for mute / solo / volume control.
 *
 * Instrument samples are loaded on-demand from the tonejs-instruments project
 * (a CC-licensed soundfont collection hosted on GitHub).
 */

const SAMPLE_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples';

/**
 * Sample maps for each instrument. Tone.js Sampler will pitch-shift to fill
 * gaps between provided samples, so a sparse map is sufficient.
 */
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

/** Color used for each part in the UI. */
export const PART_COLORS = {
  soprano: '#f87171',
  alto: '#facc15',
  tenor: '#4ade80',
  bass: '#60a5fa',
  other: '#c084fc',
};

/** Default instrument suggestion per part type. */
export const DEFAULT_INSTRUMENT = {
  soprano: 'violin',
  alto: 'violin',
  tenor: 'cello',
  bass: 'cello',
  other: 'piano',
};

export class Player {
  constructor() {
    /** @type {Record<string, any>} - cache of loaded Sampler instances per instrument */
    this.samplers = {};
    /** @type {Record<string, Promise<any>>} - in-flight loaders to dedupe parallel loads */
    this.samplerLoaders = {};
    /** @type {{partId: string, sampler: any, channel: any, notes: any[]}[]} */
    this.tracks = [];
    /** @type {any} */
    this.masterGain = null;
    /** @type {ParsedScore|null} */
    this.score = null;
    /** @type {number} BPM currently set on the transport */
    this.bpm = 100;
    /** @type {Map<string, {muted: boolean, solo: boolean, instrument: string, volume: number}>} */
    this.partSettings = new Map();
    /** @type {((info: {time: number, total: number}) => void)|null} */
    this.onProgress = null;
    /** @type {(() => void)|null} */
    this.onEnd = null;
    this._progressInterval = null;
  }

  /** Lazy-load a Tone.Sampler for a given instrument name. Deduped across calls. */
  async loadInstrument(name) {
    if (this.samplers[name]) return this.samplers[name];
    if (this.samplerLoaders[name]) return this.samplerLoaders[name];
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

  /** Initialize the audio context (must be called from a user gesture). */
  async init() {
    await Tone.start();
    if (!this.masterGain) {
      this.masterGain = new Tone.Gain(Tone.dbToGain(-6)).toDestination();
    }
  }

  setMasterVolumeDb(db) {
    if (this.masterGain) this.masterGain.gain.value = Tone.dbToGain(db);
  }

  setBpm(bpm) {
    this.bpm = bpm;
    Tone.Transport.bpm.value = bpm;
  }

  /**
   * Load a parsed score into the player. Initializes per-part settings and
   * pre-loads required instruments.
   */
  async loadScore(score) {
    this.stop();
    this.score = score;

    // Initialize default per-part settings
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

    // Pre-load instruments for all parts
    const insSet = new Set();
    for (const part of score.parts) {
      insSet.add(this.partSettings.get(part.id).instrument);
    }
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

  /** Schedule and start playback. */
  async play() {
    if (!this.score) return;
    await this.init();

    // Tear down any previous tracks and clear transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this._teardownTracks();

    // Compute total seconds
    const beatSec = 60 / this.bpm;

    // Create a channel + sampler connection per part, schedule notes
    for (const part of this.score.parts) {
      const settings = this.partSettings.get(part.id);
      const sampler = await this.loadInstrument(settings.instrument);
      // Cloning isn't really possible — instead use a Volume node per part
      const channel = new Tone.Volume(settings.volume).connect(this.masterGain);
      // Connect the sampler to this channel. Note: a Tone.Sampler can have
      // multiple downstream connections; we use chain() to ensure routing.
      sampler.connect(channel);

      const events = [];
      for (const note of part.notes) {
        if (note.rest || !note.pitch) continue;
        events.push({
          time: note.startBeat * beatSec,
          duration: note.duration * beatSec,
          pitch: note.pitch,
        });
      }

      // Schedule via Tone.Part for robust transport-relative timing
      const tonePart = new Tone.Part((time, ev) => {
        try {
          sampler.triggerAttackRelease(ev.pitch, Math.max(0.05, ev.duration), time);
        } catch (e) {
          // Skip pitches that fall outside instrument range
          console.warn('Skipping note', ev.pitch, e.message);
        }
      }, events.map((e) => [e.time, e]));
      tonePart.start(0);

      this.tracks.push({ partId: part.id, sampler, channel, tonePart });
    }

    this._updateMuteStates();

    // Schedule end-of-playback callback
    const totalSec = this.score.totalBeats * beatSec + 1.5;
    Tone.Transport.scheduleOnce(() => this.stop(), totalSec);

    Tone.Transport.position = 0;
    Tone.Transport.start();

    // Progress notifications
    if (this._progressInterval) clearInterval(this._progressInterval);
    const total = this.score.totalBeats * beatSec;
    this._progressInterval = setInterval(() => {
      if (this.onProgress) {
        this.onProgress({ time: Math.min(Tone.Transport.seconds, total), total });
      }
    }, 100);
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
    this._teardownTracks();
    if (this.onEnd) this.onEnd();
  }

  _teardownTracks() {
    for (const tr of this.tracks) {
      try { tr.tonePart.stop(); tr.tonePart.dispose(); } catch {}
      try { tr.sampler.disconnect(tr.channel); } catch {}
      try { tr.channel.dispose(); } catch {}
    }
    this.tracks = [];
  }
}

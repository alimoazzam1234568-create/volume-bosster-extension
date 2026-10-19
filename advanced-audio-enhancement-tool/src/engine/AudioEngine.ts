/**
 * Advanced Audio Engine
 * - Captures audio from any browser tab, any window, or entire screen
 * - Full processing chain with anti-doubling, limiter, smooth transitions
 * - Real-time spectrum analysis and metering
 */

// ─── Types ───

export interface EQBand {
  id: string;
  label: string;
  frequency: number;   // center freq in Hz
  gain: number;        // -15 to +15 dB
  type: BiquadFilterType;
  color: string;
}

export interface AudioSettings {
  // Volume
  masterVolume: number;        // 0–500 %
  // 5-Band EQ gains
  eqBands: Record<string, number>; // band id → dB
  // Dynamics
  compressorOn: boolean;
  compThreshold: number;       // -60 to 0
  compRatio: number;           // 1 to 20
  compAttack: number;          // 0.001 to 1 s
  compRelease: number;         // 0.01 to 1 s
  compKnee: number;            // 0 to 40
  // Limiter always on
  limiterOn: boolean;
  limiterCeiling: number;      // -6 to 0 dB
  // Clarity / presence
  clarityOn: boolean;
  clarityAmount: number;       // 0–100
  // Noise / gate
  noiseGateOn: boolean;
  noiseGateAmount: number;     // 0–100
  // De-esser
  deEsserOn: boolean;
  deEsserAmount: number;       // 0–100
  // Spatial
  stereoWidth: number;         // 0–200 % (100 = normal)
  // Reverb
  reverbOn: boolean;
  reverbMix: number;           // 0–100
  reverbPreset: string;
  // Smoothing
  rampTime: number;            // seconds for parameter ramps
}

export const EQ_BAND_DEFS: EQBand[] = [
  { id: "sub",     label: "Sub Bass",    frequency: 60,    gain: 0, type: "lowshelf",  color: "#ef4444" },
  { id: "bass",    label: "Bass",        frequency: 230,   gain: 0, type: "peaking",   color: "#f97316" },
  { id: "lowMid",  label: "Low Mid",     frequency: 900,   gain: 0, type: "peaking",   color: "#eab308" },
  { id: "presence",label: "Presence",    frequency: 4000,  gain: 0, type: "peaking",   color: "#22c55e" },
  { id: "air",     label: "Air / Treble",frequency: 12000, gain: 0, type: "highshelf", color: "#3b82f6" },
];

function defaultEQGains(): Record<string, number> {
  const obj: Record<string, number> = {};
  EQ_BAND_DEFS.forEach((b) => (obj[b.id] = 0));
  return obj;
}

export const defaultSettings: AudioSettings = {
  masterVolume: 100,
  eqBands: defaultEQGains(),
  compressorOn: true,
  compThreshold: -24,
  compRatio: 4,
  compAttack: 0.006,
  compRelease: 0.15,
  compKnee: 12,
  limiterOn: true,
  limiterCeiling: -1,
  clarityOn: true,
  clarityAmount: 50,
  noiseGateOn: true,
  noiseGateAmount: 20,
  deEsserOn: true,
  deEsserAmount: 30,
  stereoWidth: 100,
  reverbOn: false,
  reverbMix: 20,
  reverbPreset: "room",
  rampTime: 0.08,
};

export interface Preset {
  name: string;
  icon: string;
  desc: string;
  settings: Partial<AudioSettings>;
}

export const PRESETS: Preset[] = [
  {
    name: "Voice Clarity",
    icon: "🎙",
    desc: "Crisp voice for calls & videos",
    settings: {
      masterVolume: 160,
      eqBands: { sub: -3, bass: -2, lowMid: 4, presence: 5, air: 2 },
      compThreshold: -20, compRatio: 6, clarityAmount: 80,
      noiseGateAmount: 40, deEsserAmount: 50, stereoWidth: 80,
      reverbOn: false,
    },
  },
  {
    name: "YouTube Clear",
    icon: "📺",
    desc: "Clear YouTube / video audio",
    settings: {
      masterVolume: 180,
      eqBands: { sub: 2, bass: 2, lowMid: 5, presence: 3, air: 2 },
      compThreshold: -22, compRatio: 5, clarityAmount: 75,
      noiseGateAmount: 30, deEsserAmount: 40, stereoWidth: 90,
      reverbOn: false,
    },
  },
  {
    name: "Music Boost",
    icon: "🎵",
    desc: "Rich, punchy music",
    settings: {
      masterVolume: 200,
      eqBands: { sub: 6, bass: 4, lowMid: 1, presence: 3, air: 4 },
      compThreshold: -18, compRatio: 3, clarityAmount: 60,
      noiseGateAmount: 10, deEsserAmount: 20, stereoWidth: 120,
      reverbOn: true, reverbMix: 12,
    },
  },
  {
    name: "Bass Monster",
    icon: "🔊",
    desc: "Deep heavy bass",
    settings: {
      masterVolume: 220,
      eqBands: { sub: 10, bass: 6, lowMid: -1, presence: -2, air: -3 },
      compThreshold: -15, compRatio: 4, clarityAmount: 40,
      noiseGateAmount: 10, deEsserAmount: 10, stereoWidth: 110,
      reverbOn: false,
    },
  },
  {
    name: "Fix Grinding",
    icon: "🔧",
    desc: "Clean up unclear / grinding audio",
    settings: {
      masterVolume: 160,
      eqBands: { sub: -4, bass: -3, lowMid: 3, presence: 2, air: -2 },
      compThreshold: -25, compRatio: 8, clarityAmount: 90,
      noiseGateAmount: 60, deEsserAmount: 60, stereoWidth: 70,
      reverbOn: false,
    },
  },
  {
    name: "Podcast",
    icon: "🎧",
    desc: "Warm podcast voice",
    settings: {
      masterVolume: 170,
      eqBands: { sub: 1, bass: 1, lowMid: 6, presence: 2, air: 1 },
      compThreshold: -20, compRatio: 6, clarityAmount: 85,
      noiseGateAmount: 45, deEsserAmount: 45, stereoWidth: 75,
      reverbOn: false,
    },
  },
  {
    name: "Gaming",
    icon: "🎮",
    desc: "Immersive game audio",
    settings: {
      masterVolume: 190,
      eqBands: { sub: 4, bass: 3, lowMid: 2, presence: 4, air: 5 },
      compThreshold: -16, compRatio: 3, clarityAmount: 70,
      noiseGateAmount: 15, deEsserAmount: 20, stereoWidth: 140,
      reverbOn: true, reverbMix: 15,
    },
  },
  {
    name: "Max Volume",
    icon: "🚀",
    desc: "Push volume to the limit",
    settings: {
      masterVolume: 450,
      eqBands: { sub: 4, bass: 3, lowMid: 3, presence: 3, air: 3 },
      compThreshold: -10, compRatio: 12, clarityAmount: 60,
      noiseGateAmount: 20, deEsserAmount: 30, stereoWidth: 100,
      reverbOn: false,
    },
  },
  {
    name: "Smooth & Warm",
    icon: "☀",
    desc: "Warm, gentle, zero harshness",
    settings: {
      masterVolume: 140,
      eqBands: { sub: 3, bass: 2, lowMid: 1, presence: -1, air: -3 },
      compThreshold: -22, compRatio: 4, clarityAmount: 40,
      noiseGateAmount: 25, deEsserAmount: 55, stereoWidth: 95,
      reverbOn: true, reverbMix: 8,
    },
  },
  {
    name: "Flat",
    icon: "◼",
    desc: "No processing — reference",
    settings: {
      masterVolume: 100,
      eqBands: defaultEQGains(),
      compThreshold: 0, compRatio: 1, clarityAmount: 0,
      noiseGateAmount: 0, deEsserAmount: 0, stereoWidth: 100,
      reverbOn: false, clarityOn: false, noiseGateOn: false,
      deEsserOn: false, compressorOn: false,
    },
  },
];

export type CaptureSource = "tab" | "window" | "screen" | "mic";

// ─── Engine ───

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  // Input / routing
  private inputGain: GainNode | null = null;

  // EQ chain
  private eqFilters: Map<string, BiquadFilterNode> = new Map();

  // Clarity
  private clarityFilter: BiquadFilterNode | null = null;
  private clarityGainNode: GainNode | null = null;

  // Noise gate (highpass)
  private noiseFilter: BiquadFilterNode | null = null;

  // De-esser (lowpass)
  private deEsserFilter: BiquadFilterNode | null = null;

  // Compressor
  private compressor: DynamicsCompressorNode | null = null;

  // Stereo width
  private stereoGain: GainNode | null = null;
  private midGain: GainNode | null = null;
  private sideGain: GainNode | null = null;
  private splitterNode: ChannelSplitterNode | null = null;
  private mergerNode: ChannelMergerNode | null = null;

  // Master
  private masterGain: GainNode | null = null;

  // Reverb
  private convolver: ConvolverNode | null = null;
  private reverbWet: GainNode | null = null;
  private reverbDry: GainNode | null = null;
  private reverbMerger: GainNode | null = null;

  // Limiter
  private limiter: DynamicsCompressorNode | null = null;

  // Output
  private analyser: AnalyserNode | null = null;
  private outputGain: GainNode | null = null;

  // Stream
  private stream: MediaStream | null = null;
  private isActive = false;
  private rampTime = 0.08;

  public onStreamEnded: (() => void) | null = null;

  // ─── Lifecycle ───

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ latencyHint: "interactive", sampleRate: 48000 });
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  // ─── Capture ───

  async captureTab(): Promise<MediaStream> {
    const constraints: any = {
      video: { width: 1, height: 1 },
      audio: {
        suppressLocalAudioPlayback: true,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      preferCurrentTab: false,
      selfBrowserSurface: "include",
      systemAudio: "exclude",
      surfaceSwitching: "include",
    };

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      this.validateStream(stream);
      this.stopVideoTracks(stream);
      this.stream = stream;
      this.watchTracks(stream);
      return stream;
    } catch (err: any) {
      throw this.parseCaptureError(err, "tab");
    }
  }

  async captureWindow(): Promise<MediaStream> {
    const constraints: any = {
      video: true,
      audio: {
        suppressLocalAudioPlayback: true,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      preferCurrentTab: false,
      selfBrowserSurface: "include",
      systemAudio: "include",
      surfaceSwitching: "include",
    };

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      this.validateStream(stream);
      this.stopVideoTracks(stream);
      this.stream = stream;
      this.watchTracks(stream);
      return stream;
    } catch (err: any) {
      throw this.parseCaptureError(err, "window");
    }
  }

  async captureScreen(): Promise<MediaStream> {
    const constraints: any = {
      video: true,
      audio: {
        suppressLocalAudioPlayback: true,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      preferCurrentTab: false,
      selfBrowserSurface: "include",
      systemAudio: "include",
      surfaceSwitching: "include",
    };

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      this.validateStream(stream);
      this.stopVideoTracks(stream);
      this.stream = stream;
      this.watchTracks(stream);
      return stream;
    } catch (err: any) {
      throw this.parseCaptureError(err, "screen");
    }
  }

  async captureMic(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 2,
          sampleRate: 48000,
        },
      });
      this.stream = stream;
      this.watchTracks(stream);
      return stream;
    } catch (err: any) {
      throw this.parseCaptureError(err, "microphone");
    }
  }

  private validateStream(stream: MediaStream) {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(
        "No audio track found. Make sure to enable 'Share audio' when selecting a source."
      );
    }
  }

  private stopVideoTracks(stream: MediaStream) {
    stream.getVideoTracks().forEach((t) => t.stop());
  }

  private watchTracks(stream: MediaStream) {
    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        this.onStreamEnded?.();
      });
    });
  }

  private parseCaptureError(err: any, type: string): Error {
    if (err.name === "NotAllowedError") {
      return new Error(
        `Permission denied. Please allow ${type} access when the browser asks.`
      );
    }
    if (err.name === "NotFoundError") {
      return new Error(`No ${type} source found.`);
    }
    if (err.name === "AbortError") {
      return new Error("Capture was cancelled.");
    }
    return new Error(err.message || `Failed to capture ${type}.`);
  }

  // ─── Processing Chain ───

  async buildChain(settings: AudioSettings): Promise<AnalyserNode> {
    if (!this.stream) throw new Error("No audio stream. Capture first.");

    const ctx = await this.ensureContext();
    this.rampTime = settings.rampTime;

    // Source
    this.sourceNode = ctx.createMediaStreamSource(this.stream);

    // Input gain
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1;

    // Noise gate (highpass)
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = "highpass";
    this.noiseFilter.frequency.value = 60;
    this.noiseFilter.Q.value = 0.5;

    // 5-band EQ
    this.eqFilters.clear();
    let prevEq: AudioNode = this.noiseFilter;
    EQ_BAND_DEFS.forEach((band) => {
      const f = ctx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.frequency;
      if (band.type === "peaking") f.Q.value = 1.0;
      f.gain.value = settings.eqBands[band.id] ?? 0;
      this.eqFilters.set(band.id, f);
      prevEq.connect(f);
      prevEq = f;
    });

    // Clarity filter (presence boost)
    this.clarityFilter = ctx.createBiquadFilter();
    this.clarityFilter.type = "peaking";
    this.clarityFilter.frequency.value = 3200;
    this.clarityFilter.Q.value = 1.0;
    this.clarityGainNode = ctx.createGain();
    this.clarityGainNode.gain.value = 1;

    // De-esser (lowpass)
    this.deEsserFilter = ctx.createBiquadFilter();
    this.deEsserFilter.type = "lowpass";
    this.deEsserFilter.frequency.value = 18000;
    this.deEsserFilter.Q.value = 0.5;

    // Compressor
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = settings.compThreshold;
    this.compressor.ratio.value = settings.compRatio;
    this.compressor.knee.value = settings.compKnee;
    this.compressor.attack.value = settings.compAttack;
    this.compressor.release.value = settings.compRelease;

    // Stereo width (MS processing)
    this.stereoGain = ctx.createGain();
    this.stereoGain.gain.value = 1;
    this.splitterNode = ctx.createChannelSplitter(2);
    this.mergerNode = ctx.createChannelMerger(2);
    this.midGain = ctx.createGain();
    this.sideGain = ctx.createGain();

    // Master gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = settings.masterVolume / 100;

    // Reverb
    this.reverbDry = ctx.createGain();
    this.reverbWet = ctx.createGain();
    this.reverbMerger = ctx.createGain();
    this.reverbDry.gain.value = 1;
    this.reverbWet.gain.value = 0;

    try {
      this.convolver = ctx.createConvolver();
      this.convolver.buffer = this.createReverbImpulse(ctx, settings.reverbPreset);
    } catch {
      this.convolver = null;
    }

    // Limiter (brick-wall)
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = settings.limiterCeiling;
    this.limiter.ratio.value = 20;
    this.limiter.knee.value = 0;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;

    // Output gain (for graceful fade-in/out)
    this.outputGain = ctx.createGain();
    this.outputGain.gain.setValueAtTime(0, ctx.currentTime);

    // Analyser
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.82;

    // ─── Connect ───
    this.sourceNode.connect(this.inputGain);
    this.inputGain.connect(this.noiseFilter);
    // noise → EQ chain already wired above
    // Last EQ → clarity filter
    prevEq.connect(this.clarityFilter);
    this.clarityFilter.connect(this.clarityGainNode);
    this.clarityGainNode.connect(this.deEsserFilter);
    this.deEsserFilter.connect(this.compressor);

    // Stereo width
    this.compressor.connect(this.splitterNode);
    // For simplicity with MS: use gain-based stereo width
    this.splitterNode.connect(this.midGain, 0);
    this.splitterNode.connect(this.sideGain, 1);
    this.midGain.connect(this.mergerNode, 0, 0);
    this.sideGain.connect(this.mergerNode, 0, 1);
    this.mergerNode.connect(this.stereoGain);

    // Stereo → master
    this.stereoGain.connect(this.masterGain);

    // Master → reverb split
    if (this.convolver) {
      this.masterGain.connect(this.reverbDry);
      this.masterGain.connect(this.convolver);
      this.convolver.connect(this.reverbWet);
      this.reverbDry.connect(this.reverbMerger);
      this.reverbWet.connect(this.reverbMerger);
    } else {
      this.masterGain.connect(this.reverbMerger);
    }

    this.reverbMerger.connect(this.limiter);
    this.limiter.connect(this.outputGain);
    this.outputGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // Fade in
    this.outputGain.gain.setTargetAtTime(1, ctx.currentTime, 0.05);

    this.isActive = true;
    return this.analyser;
  }

  private createReverbImpulse(
    ctx: AudioContext,
    preset: string = "room"
  ): AudioBuffer {
    const durations: Record<string, number> = {
      small: 0.8, room: 1.5, hall: 3.0, cathedral: 5.0,
    };
    const duration = durations[preset] || 1.5;
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

    const decayPower: Record<string, number> = {
      small: 3, room: 4, hall: 3, cathedral: 2.5,
    };
    const decay = decayPower[preset] || 4;

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.5;
      }
    }
    return impulse;
  }

  // ─── Parameter Updates ───

  applySettings(s: AudioSettings) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.rampTime = s.rampTime;
    const r = this.rampTime;

    // Master volume
    if (this.masterGain) {
      const gain = Math.max(0.0001, s.masterVolume / 100);
      this.masterGain.gain.setTargetAtTime(gain, now, r);
    }

    // EQ
    EQ_BAND_DEFS.forEach((band) => {
      const f = this.eqFilters.get(band.id);
      if (f) {
        const gain = s.eqBands[band.id] ?? 0;
        f.gain.setTargetAtTime(gain, now, r);
      }
    });

    // Clarity
    if (this.clarityFilter && this.clarityGainNode) {
      if (s.clarityOn) {
        const g = (s.clarityAmount / 100) * 8;
        this.clarityFilter.gain.setTargetAtTime(g, now, r);
        this.clarityFilter.Q.setTargetAtTime(0.5 + (s.clarityAmount / 100) * 1.5, now, r);
      } else {
        this.clarityFilter.gain.setTargetAtTime(0, now, r);
      }
    }

    // Noise gate
    if (this.noiseFilter) {
      if (s.noiseGateOn) {
        const freq = 20 + (s.noiseGateAmount / 100) * 230;
        this.noiseFilter.frequency.setTargetAtTime(freq, now, r);
      } else {
        this.noiseFilter.frequency.setTargetAtTime(10, now, r);
      }
    }

    // De-esser
    if (this.deEsserFilter) {
      if (s.deEsserOn) {
        const freq = 20000 - (s.deEsserAmount / 100) * 12000;
        this.deEsserFilter.frequency.setTargetAtTime(freq, now, r);
      } else {
        this.deEsserFilter.frequency.setTargetAtTime(22000, now, r);
      }
    }

    // Compressor
    if (this.compressor) {
      const on = s.compressorOn;
      this.compressor.threshold.setTargetAtTime(on ? s.compThreshold : 0, now, r);
      this.compressor.ratio.setTargetAtTime(on ? s.compRatio : 1, now, r);
      this.compressor.knee.setTargetAtTime(s.compKnee, now, r);
      this.compressor.attack.setTargetAtTime(s.compAttack, now, r);
      this.compressor.release.setTargetAtTime(s.compRelease, now, r);
    }

    // Stereo width via M/S: increase side channel gain to widen
    if (this.sideGain && this.midGain) {
      const w = s.stereoWidth / 100; // 0–2
      this.sideGain.gain.setTargetAtTime(Math.max(0.01, w), now, r);
      this.midGain.gain.setTargetAtTime(1, now, r);
    }

    // Reverb
    if (this.reverbDry && this.reverbWet) {
      if (s.reverbOn) {
        const mix = s.reverbMix / 100;
        this.reverbDry.gain.setTargetAtTime(Math.cos((mix * Math.PI) / 2), now, r);
        this.reverbWet.gain.setTargetAtTime(Math.sin((mix * Math.PI) / 2) * 0.6, now, r);
      } else {
        this.reverbDry.gain.setTargetAtTime(1, now, r);
        this.reverbWet.gain.setTargetAtTime(0, now, r);
      }
    }

    // Limiter ceiling
    if (this.limiter) {
      this.limiter.threshold.setTargetAtTime(
        s.limiterOn ? s.limiterCeiling : 0,
        now,
        r
      );
    }
  }

  // ─── Metering ───

  getAnalyserData(): { frequency: Uint8Array; timeDomain: Uint8Array } | null {
    if (!this.analyser) return null;
    const freq = new Uint8Array(this.analyser.frequencyBinCount);
    const td = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteFrequencyData(freq);
    this.analyser.getByteTimeDomainData(td);
    return { frequency: freq, timeDomain: td };
  }

  getRMSLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 255;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  getPeakLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > max) max = data[i];
    }
    return max / 255;
  }

  getCompressorReduction(): number {
    return this.compressor?.reduction ?? 0;
  }

  getLimiterReduction(): number {
    return this.limiter?.reduction ?? 0;
  }

  getSampleRate(): number {
    return this.ctx?.sampleRate ?? 0;
  }

  getLatency(): number {
    return this.ctx?.baseLatency ?? 0;
  }

  isProcessing(): boolean {
    return this.isActive;
  }

  // ─── Teardown ───

  stop() {
    if (this.ctx && this.outputGain && this.isActive) {
      const now = this.ctx.currentTime;
      this.outputGain.gain.setTargetAtTime(0, now, 0.03);
      setTimeout(() => this._disconnect(), 100);
    } else {
      this._disconnect();
    }
    this.isActive = false;
  }

  private _disconnect() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }

    const nodes: (AudioNode | null)[] = [
      this.inputGain, this.noiseFilter, this.clarityFilter,
      this.clarityGainNode, this.deEsserFilter, this.compressor,
      this.stereoGain, this.splitterNode, this.mergerNode,
      this.midGain, this.sideGain, this.masterGain,
      this.reverbDry, this.reverbWet, this.reverbMerger,
      this.convolver, this.limiter, this.outputGain, this.analyser,
      ...Array.from(this.eqFilters.values()),
    ];

    nodes.forEach((n) => { if (n) try { n.disconnect(); } catch {} });

    this.inputGain = null;
    this.noiseFilter = null;
    this.clarityFilter = null;
    this.clarityGainNode = null;
    this.deEsserFilter = null;
    this.compressor = null;
    this.stereoGain = null;
    this.splitterNode = null;
    this.mergerNode = null;
    this.midGain = null;
    this.sideGain = null;
    this.masterGain = null;
    this.reverbDry = null;
    this.reverbWet = null;
    this.reverbMerger = null;
    this.convolver = null;
    this.limiter = null;
    this.outputGain = null;
    this.analyser = null;
    this.eqFilters.clear();
  }

  async destroy() {
    this.stop();
    if (this.ctx && this.ctx.state !== "closed") {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}

/**
 * Volume Corrector Pro — Offscreen Audio Processing Document
 * Contains the full Web Audio API processing chain
 * Receives commands via chrome.runtime messaging
 */

let audioCtx = null;
let sourceNode = null;
let inputGain = null;
let noiseFilter = null;
let eqFilters = {};
let clarityFilter = null;
let clarityGain = null;
let deEsserFilter = null;
let compressor = null;
let stereoSplitter = null;
let stereoMerger = null;
let midGain = null;
let sideGain = null;
let stereoGain = null;
let masterGain = null;
let reverbDry = null;
let reverbWet = null;
let reverbMerger = null;
let convolver = null;
let limiterNode = null;
let outputGain = null;
let analyser = null;
let mediaStream = null;
let isActive = false;

const EQ_BANDS = [
  { id: "sub", freq: 60, type: "lowshelf", q: 0.7 },
  { id: "bass", freq: 230, type: "peaking", q: 1.0 },
  { id: "lowMid", freq: 900, type: "peaking", q: 1.0 },
  { id: "presence", freq: 4000, type: "peaking", q: 1.0 },
  { id: "air", freq: 12000, type: "highshelf", q: 0.7 },
];

// ─── Audio Context ───

async function ensureAudioContext() {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext({ latencyHint: "interactive", sampleRate: 48000 });
  }
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  return audioCtx;
}

// ─── Build Processing Chain ───

async function setupAudio(streamId, settings) {
  try {
    await destroyAudio();
    const ctx = await ensureAudioContext();

    console.log("[OFFSCREEN] Setting up audio with streamId:", !!streamId);

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    sourceNode = ctx.createMediaStreamSource(mediaStream);

    // Input
    inputGain = ctx.createGain();
    inputGain.gain.value = 1;

    // Noise gate (highpass)
    noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 60;
    noiseFilter.Q.value = 0.5;

    // 5-Band EQ
    eqFilters = {};
    let prevNode = noiseFilter;
    EQ_BANDS.forEach((band) => {
      const f = ctx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      if (band.type === "peaking") f.Q.value = band.q;
      f.gain.value = settings.eqBands?.[band.id] || 0;
      eqFilters[band.id] = f;
      prevNode.connect(f);
      prevNode = f;
    });

    // Clarity
    clarityFilter = ctx.createBiquadFilter();
    clarityFilter.type = "peaking";
    clarityFilter.frequency.value = 3200;
    clarityFilter.Q.value = 1.0;
    clarityGain = ctx.createGain();
    clarityGain.gain.value = 1;

    // De-esser
    deEsserFilter = ctx.createBiquadFilter();
    deEsserFilter.type = "lowpass";
    deEsserFilter.frequency.value = 18000;
    deEsserFilter.Q.value = 0.5;

    // Compressor
    compressor = ctx.createDynamicsCompressor();

    // Stereo
    stereoSplitter = ctx.createChannelSplitter(2);
    stereoMerger = ctx.createChannelMerger(2);
    midGain = ctx.createGain();
    sideGain = ctx.createGain();
    stereoGain = ctx.createGain();

    // Master
    masterGain = ctx.createGain();

    // Reverb
    reverbDry = ctx.createGain();
    reverbWet = ctx.createGain();
    reverbMerger = ctx.createGain();
    try {
      convolver = ctx.createConvolver();
      convolver.buffer = createReverbImpulse(ctx, settings.reverbPreset || "room");
    } catch {
      convolver = null;
    }

    // Limiter
    limiterNode = ctx.createDynamicsCompressor();
    limiterNode.threshold.value = -1;
    limiterNode.ratio.value = 20;
    limiterNode.knee.value = 0;
    limiterNode.attack.value = 0.0005;
    limiterNode.release.value = 0.04;

    // Output
    outputGain = ctx.createGain();
    outputGain.gain.value = 0;

    // Analyser
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    // ─── Connect ───
    sourceNode.connect(inputGain);
    inputGain.connect(noiseFilter);
    // noise → EQ chain (already wired)
    const lastEQ = eqFilters["air"];
    lastEQ.connect(clarityFilter);
    clarityFilter.connect(clarityGain);
    clarityGain.connect(deEsserFilter);
    deEsserFilter.connect(compressor);

    compressor.connect(stereoSplitter);
    stereoSplitter.connect(midGain, 0);
    stereoSplitter.connect(sideGain, 1);
    midGain.connect(stereoMerger, 0, 0);
    sideGain.connect(stereoMerger, 0, 1);
    stereoMerger.connect(stereoGain);
    stereoGain.connect(masterGain);

    if (convolver) {
      masterGain.connect(reverbDry);
      masterGain.connect(convolver);
      convolver.connect(reverbWet);
      reverbDry.connect(reverbMerger);
      reverbWet.connect(reverbMerger);
    } else {
      masterGain.connect(reverbMerger);
    }

    reverbMerger.connect(limiterNode);
    limiterNode.connect(outputGain);
    outputGain.connect(analyser);
    analyser.connect(ctx.destination);

    // Fade in
    outputGain.gain.setTargetAtTime(1, ctx.currentTime, 0.05);

    // Apply settings
    applySettingsInternal(settings);

    isActive = true;
    console.log("[OFFSCREEN] Audio chain built and running");

    // Watch for stream end
    mediaStream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        console.log("[OFFSCREEN] Stream track ended");
        isActive = false;
        try {
          chrome.runtime.sendMessage({ type: "STREAM_ENDED" });
        } catch {}
      });
    });

    return { success: true };
  } catch (err) {
    console.error("[OFFSCREEN] Setup failed:", err);
    return { success: false, error: err.message };
  }
}

// ─── Reverb Impulse ───

function createReverbImpulse(ctx, preset) {
  const durations = { small: 0.6, room: 1.2, hall: 2.5, cathedral: 4.0 };
  const decays = { small: 3.5, room: 4, hall: 3, cathedral: 2.2 };
  const dur = durations[preset] || 1.2;
  const decay = decays[preset] || 4;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.4;
    }
  }
  return buf;
}

// ─── Apply Settings ───

function applySettingsInternal(s) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const ramp = s.rampTime || 0.06;

  if (masterGain) {
    masterGain.gain.setTargetAtTime(Math.max(0.0001, (s.masterVolume || 100) / 100), now, ramp);
  }

  EQ_BANDS.forEach((band) => {
    const f = eqFilters[band.id];
    if (f) {
      f.gain.setTargetAtTime(s.eqBands?.[band.id] || 0, now, ramp);
    }
  });

  if (clarityFilter) {
    if (s.clarityOn !== false) {
      clarityFilter.gain.setTargetAtTime(((s.clarityAmount || 0) / 100) * 8, now, ramp);
      clarityFilter.Q.setTargetAtTime(0.5 + ((s.clarityAmount || 0) / 100) * 1.5, now, ramp);
    } else {
      clarityFilter.gain.setTargetAtTime(0, now, ramp);
    }
  }

  if (noiseFilter) {
    if (s.noiseGateOn !== false) {
      noiseFilter.frequency.setTargetAtTime(20 + ((s.noiseGateAmount || 0) / 100) * 230, now, ramp);
    } else {
      noiseFilter.frequency.setTargetAtTime(10, now, ramp);
    }
  }

  if (deEsserFilter) {
    if (s.deEsserOn !== false) {
      deEsserFilter.frequency.setTargetAtTime(20000 - ((s.deEsserAmount || 0) / 100) * 12000, now, ramp);
    } else {
      deEsserFilter.frequency.setTargetAtTime(22000, now, ramp);
    }
  }

  if (compressor) {
    const compOn = s.compressorOn !== false;
    compressor.threshold.setTargetAtTime(compOn ? (s.compThreshold ?? -24) : 0, now, ramp);
    compressor.ratio.setTargetAtTime(compOn ? (s.compRatio ?? 4) : 1, now, ramp);
    compressor.knee.setTargetAtTime(s.compKnee ?? 12, now, ramp);
    compressor.attack.setTargetAtTime(s.compAttack ?? 0.006, now, ramp);
    compressor.release.setTargetAtTime(s.compRelease ?? 0.15, now, ramp);
  }

  if (sideGain && midGain) {
    const w = (s.stereoWidth ?? 100) / 100;
    sideGain.gain.setTargetAtTime(Math.max(0.01, w), now, ramp);
    midGain.gain.setTargetAtTime(1, now, ramp);
  }

  if (reverbDry && reverbWet) {
    if (s.reverbOn) {
      const mix = (s.reverbMix ?? 20) / 100;
      reverbDry.gain.setTargetAtTime(Math.cos((mix * Math.PI) / 2), now, ramp);
      reverbWet.gain.setTargetAtTime(Math.sin((mix * Math.PI) / 2) * 0.6, now, ramp);
    } else {
      reverbDry.gain.setTargetAtTime(1, now, ramp);
      reverbWet.gain.setTargetAtTime(0, now, ramp);
    }
  }

  if (limiterNode) {
    limiterNode.threshold.setTargetAtTime(
      s.limiterOn !== false ? (s.limiterCeiling ?? -1) : 0,
      now, ramp
    );
  }
}

// ─── Teardown ───

async function destroyAudio() {
  isActive = false;
  if (outputGain && audioCtx) {
    outputGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
    await new Promise((r) => setTimeout(r, 80));
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  const nodes = [
    sourceNode, inputGain, noiseFilter, clarityFilter, clarityGain, deEsserFilter,
    compressor, stereoSplitter, stereoMerger, midGain, sideGain, stereoGain,
    masterGain, reverbDry, reverbWet, reverbMerger, convolver, limiterNode,
    outputGain, analyser, ...Object.values(eqFilters),
  ];
  nodes.forEach((n) => { if (n) try { n.disconnect(); } catch {} });
  sourceNode = null; inputGain = null; noiseFilter = null; eqFilters = {};
  clarityFilter = null; clarityGain = null; deEsserFilter = null; compressor = null;
  stereoSplitter = null; stereoMerger = null; midGain = null; sideGain = null;
  stereoGain = null; masterGain = null; reverbDry = null; reverbWet = null;
  reverbMerger = null; convolver = null; limiterNode = null; outputGain = null;
  analyser = null;
}

// ─── Message Listener ───

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "SETUP_AUDIO":
      setupAudio(message.streamId, message.settings || {}).then(sendResponse);
      return true;
    case "TEARDOWN_AUDIO":
      destroyAudio().then(() => sendResponse({ success: true }));
      return true;
    case "APPLY_SETTINGS":
      applySettingsInternal(message.settings || {});
      sendResponse({ success: true });
      return true;
    case "GET_STATE":
      sendResponse({ active: isActive });
      return true;
    case "GET_ANALYZER":
      if (!analyser) {
        sendResponse({ data: null });
      } else {
        const freq = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freq);
        let sum = 0, peakV = 0;
        for (let i = 0; i < freq.length; i++) {
          const v = freq[i] / 255;
          sum += v * v;
          if (v > peakV) peakV = v;
        }
        sendResponse({
          data: {
            rms: Math.sqrt(sum / freq.length),
            peak: peakV,
            compReduction: compressor?.reduction || 0,
            limitReduction: limiterNode?.reduction || 0,
          },
        });
      }
      return true;
    default:
      sendResponse({ success: false });
      return true;
  }
});

console.log("[OFFSCREEN] Volume Corrector Pro audio engine loaded");

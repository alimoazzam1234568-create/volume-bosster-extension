/**
 * Volume Corrector Pro — Chrome Extension Popup Script
 * Communicates with background.js → offscreen.js via chrome.runtime messaging
 */

// ─── State ───

let isActive = false;
let isBypassed = false;
let currentSource = "tab";
let settings = {
  masterVolume: 100,
  eqBands: { sub: 0, bass: 0, lowMid: 0, presence: 0, air: 0 },
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
  rampTime: 0.06,
};

const EQ_BANDS = [
  { id: "sub", label: "Sub", freq: "60Hz", color: "#ef4444" },
  { id: "bass", label: "Bass", freq: "230Hz", color: "#f97316" },
  { id: "lowMid", label: "Mid", freq: "900Hz", color: "#eab308" },
  { id: "presence", label: "Pres", freq: "4kHz", color: "#22c55e" },
  { id: "air", label: "Air", freq: "12kHz", color: "#3b82f6" },
];

const PRESETS = {
  voice: {
    volume: 160, eq: { sub: -3, bass: -2, lowMid: 4, presence: 5, air: 2 },
    clarity: 80, noise: 40, deEsser: 50, thresh: -20, ratio: 6,
  },
  youtube: {
    volume: 180, eq: { sub: 2, bass: 2, lowMid: 5, presence: 3, air: 2 },
    clarity: 75, noise: 30, deEsser: 40, thresh: -22, ratio: 5,
  },
  music: {
    volume: 200, eq: { sub: 6, bass: 4, lowMid: 1, presence: 3, air: 4 },
    clarity: 60, noise: 10, deEsser: 20, thresh: -18, ratio: 3,
  },
  bass: {
    volume: 220, eq: { sub: 10, bass: 6, lowMid: -1, presence: -2, air: -3 },
    clarity: 40, noise: 10, deEsser: 10, thresh: -15, ratio: 4,
  },
  fix: {
    volume: 160, eq: { sub: -4, bass: -3, lowMid: 3, presence: 2, air: -2 },
    clarity: 90, noise: 60, deEsser: 60, thresh: -25, ratio: 8,
  },
  max: {
    volume: 450, eq: { sub: 4, bass: 3, lowMid: 3, presence: 3, air: 3 },
    clarity: 60, noise: 20, deEsser: 30, thresh: -10, ratio: 12,
  },
};

// ─── DOM Refs ───

const $ = (id) => document.getElementById(id);

const statusBar = $("statusBar");
const liveDot = $("liveDot");
const bypassBtn = $("bypassBtn");
const antiDoubleNote = $("antiDoubleNote");
const startBtn = $("startBtn");
const captureSection = $("captureSection");
const metersSection = $("metersSection");

const volumeSlider = $("volumeSlider");
const volValue = $("volValue");
const claritySlider = $("claritySlider");
const clarityVal = $("clarityVal");
const noiseSlider = $("noiseSlider");
const noiseVal = $("noiseVal");
const deEsserSlider = $("deEsserSlider");
const deEsserVal = $("deEsserVal");
const threshSlider = $("threshSlider");
const threshVal = $("threshVal");
const ratioSlider = $("ratioSlider");
const ratioVal = $("ratioVal");

const compToggle = $("compToggle");
const limiterToggle = $("limiterToggle");

const levelBar = $("levelBar");
const levelPct = $("levelPct");
const compBar = $("compBar");
const compVal = $("compVal");
const limitBar = $("limitBar");
const limitVal = $("limitVal");

// ─── Messaging Helper ───

function sendMessage(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp);
        }
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

// ─── Status ───

function setStatus(text, type = "info") {
  statusBar.textContent = text;
  statusBar.className = `status-bar status-${type}`;
}

// ─── Build EQ Grid ───

function buildEQGrid() {
  const grid = $("eqGrid");
  grid.innerHTML = "";
  EQ_BANDS.forEach((band) => {
    const div = document.createElement("div");
    div.className = "eq-fader";
    div.innerHTML = `
      <span class="eq-val" id="eq-val-${band.id}">0</span>
      <div class="eq-track" data-band="${band.id}" title="${band.label} ${band.freq}">
        <div class="eq-fill" id="eq-fill-${band.id}" style="background:${band.color}"></div>
      </div>
      <span class="eq-label">${band.label}<br>${band.freq}</span>
    `;
    grid.appendChild(div);

    // Click to set value
    const track = div.querySelector(".eq-track");
    track.addEventListener("click", (e) => {
      const rect = track.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pct = 1 - y / rect.height;
      const val = Math.round((pct * 30 - 15) / 0.5) * 0.5;
      updateEQ(band.id, val);
    });

    // Scroll to adjust
    track.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.5 : 0.5;
      const current = settings.eqBands[band.id] || 0;
      updateEQ(band.id, Math.round((current + delta) * 2) / 2);
    }, { passive: false });
  });
}

function updateEQDisplay(bandId, gain) {
  const valEl = $(`eq-val-${bandId}`);
  const fillEl = $(`eq-fill-${bandId}`);
  if (valEl) valEl.textContent = gain > 0 ? `+${gain}` : gain;
  if (fillEl) {
    const half = 50; // 50% of 64px track
    const h = Math.abs(gain / 15) * half;
    fillEl.style.height = `${h}%`;
    fillEl.style.bottom = gain >= 0 ? "50%" : `${50 - h}%`;
    fillEl.className = "eq-fill" + (gain >= 0 ? " positive" : "");
    const band = EQ_BANDS.find(b => b.id === bandId);
    fillEl.style.background = band?.color || "#8b5cf6";
  }
}

function updateEQ(bandId, gain) {
  gain = Math.max(-15, Math.min(15, gain));
  settings.eqBands[bandId] = gain;
  updateEQDisplay(bandId, gain);
  if (isActive) applySettings();
}

// ─── Volume Chips ───

document.querySelectorAll(".chip[data-vol]").forEach((chip) => {
  chip.addEventListener("click", () => {
    const vol = parseInt(chip.dataset.vol);
    settings.masterVolume = vol;
    volumeSlider.value = vol;
    volValue.textContent = vol + "%";
    volumeSlider.style.setProperty("--val", `${((vol - 0) / 500) * 100}%`);
    document.querySelectorAll(".chip[data-vol]").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    if (isActive) applySettings();
  });
});

// ─── EQ Quick Buttons ───

document.querySelectorAll(".chip[data-eq]").forEach((chip) => {
  chip.addEventListener("click", () => {
    const eq = chip.dataset.eq;
    const presets = {
      flat: { sub: 0, bass: 0, lowMid: 0, presence: 0, air: 0 },
      vocal: { sub: -2, bass: -1, lowMid: 5, presence: 4, air: 1 },
      bass: { sub: 8, bass: 5, lowMid: 0, presence: -2, air: -3 },
      bright: { sub: -2, bass: 0, lowMid: 2, presence: 4, air: 6 },
    };
    const values = presets[eq] || presets.flat;
    Object.keys(values).forEach((k) => updateEQ(k, values[k]));
  });
});

// ─── Slider Events ───

function bindSlider(sliderEl, valEl, key, format = (v) => v) {
  sliderEl.addEventListener("input", () => {
    const v = parseFloat(sliderEl.value);
    settings[key] = v;
    valEl.textContent = format(v);
    if (isActive) applySettings();
  });
}

bindSlider(volumeSlider, volValue, "masterVolume", (v) => v + "%");
bindSlider(claritySlider, clarityVal, "clarityAmount");
bindSlider(noiseSlider, noiseVal, "noiseGateAmount");
bindSlider(deEsserSlider, deEsserVal, "deEsserAmount");
bindSlider(threshSlider, threshVal, "compThreshold", (v) => v + "dB");
bindSlider(ratioSlider, ratioVal, "compRatio", (v) => v + ":1");

// Volume chips sync
volumeSlider.addEventListener("input", () => {
  const v = parseInt(volumeSlider.value);
  settings.masterVolume = v;
  volValue.textContent = v + "%";
  const closest = [50, 100, 150, 250, 400].reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
  document.querySelectorAll(".chip[data-vol]").forEach(c => {
    c.classList.toggle("active", parseInt(c.dataset.vol) === closest);
  });
  if (isActive) applySettings();
});

// ─── Toggle Buttons ───

compToggle.addEventListener("click", () => {
  compToggle.classList.toggle("active");
  settings.compressorOn = compToggle.classList.contains("active");
  if (isActive) applySettings();
});

limiterToggle.addEventListener("click", () => {
  limiterToggle.classList.toggle("active");
  settings.limiterOn = limiterToggle.classList.contains("active");
  if (isActive) applySettings();
});

// ─── Source Buttons ───

document.querySelectorAll(".source-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (isActive) return;
    document.querySelectorAll(".source-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentSource = btn.dataset.source;
    const hint = $("captureHint");
    if (currentSource === "tab") {
      hint.textContent = "Captures audio from the current tab. Make sure the tab is playing audio.";
    } else {
      hint.textContent = "Captures audio from any window or screen.";
    }
  });
});

// ─── Presets ───

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.preset;
    const p = PRESETS[key];
    if (!p) return;

    settings.masterVolume = p.volume;
    volumeSlider.value = p.volume;
    volValue.textContent = p.volume + "%";

    Object.keys(p.eq).forEach((k) => {
      settings.eqBands[k] = p.eq[k];
      updateEQDisplay(k, p.eq[k]);
    });

    settings.clarityAmount = p.clarity;
    claritySlider.value = p.clarity;
    clarityVal.textContent = p.clarity;

    settings.noiseGateAmount = p.noise;
    noiseSlider.value = p.noise;
    noiseVal.textContent = p.noise;

    settings.deEsserAmount = p.deEsser;
    deEsserSlider.value = p.deEsser;
    deEsserVal.textContent = p.deEsser;

    settings.compThreshold = p.thresh;
    threshSlider.value = p.thresh;
    threshVal.textContent = p.thresh + "dB";

    settings.compRatio = p.ratio;
    ratioSlider.value = p.ratio;
    ratioVal.textContent = p.ratio + ":1";

    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (isActive) applySettings();
    setStatus(`Preset applied: ${btn.textContent.trim()}`, "ok");
  });
});

// ─── Apply Settings ───

async function applySettings() {
  await sendMessage({ type: "UPDATE_SETTINGS", settings: { ...settings } });
}

// ─── Start / Stop ───

startBtn.addEventListener("click", async () => {
  if (isActive) {
    await stopCapture();
  } else {
    await startCapture();
  }
});

async function startCapture() {
  setStatus("Requesting audio capture...", "info");
  startBtn.textContent = "⏳ Capturing...";
  startBtn.disabled = true;

  try {
    const result = await sendMessage({
      type: "START_CAPTURE",
      settings: { ...settings },
    });

    if (!result.success) {
      setStatus(result.error || "Capture failed", "err");
      startBtn.textContent = "▶️ Start Enhancement";
      startBtn.disabled = false;
      return;
    }

    isActive = true;
    isBypassed = false;
    setStatus(`🎵 Enhancing "${result.tabTitle || "Tab"}" — no doubling, clean output`, "ok");

    startBtn.textContent = "⏹ Stop Processing";
    startBtn.classList.add("stop");
    startBtn.disabled = false;

    liveDot.classList.remove("hidden");
    bypassBtn.classList.remove("hidden");
    antiDoubleNote.classList.remove("hidden");
    metersSection.classList.remove("hidden");

    // Disable source selection
    document.querySelectorAll(".source-btn").forEach(b => b.disabled = true);

    // Save settings
    saveSettings();

    // Start meter polling
    startMeterPolling();
  } catch (err) {
    setStatus("Error: " + err.message, "err");
    startBtn.textContent = "▶️ Start Enhancement";
    startBtn.disabled = false;
  }
}

async function stopCapture() {
  await sendMessage({ type: "STOP_CAPTURE" });
  isActive = false;
  isBypassed = false;
  stopMeterPolling();
  setStatus("Stopped — ready to start again", "info");
  startBtn.textContent = "▶️ Start Enhancement";
  startBtn.classList.remove("stop");
  startBtn.disabled = false;
  liveDot.classList.add("hidden");
  bypassBtn.classList.add("hidden");
  bypassBtn.classList.remove("active");
  antiDoubleNote.classList.add("hidden");
  metersSection.classList.add("hidden");
  document.querySelectorAll(".source-btn").forEach(b => b.disabled = false);
}

// ─── Bypass ───

bypassBtn.addEventListener("click", async () => {
  isBypassed = !isBypassed;
  bypassBtn.classList.toggle("active", isBypassed);

  if (isBypassed) {
    setStatus("⏸ Bypass ON — raw unprocessed audio", "warn");
    await sendMessage({
      type: "UPDATE_SETTINGS",
      settings: { masterVolume: 100, compressorOn: false, clarityOn: false, noiseGateOn: false, deEsserOn: false, limiterOn: false, reverbOn: false, eqBands: { sub: 0, bass: 0, lowMid: 0, presence: 0, air: 0 } },
    });
  } else {
    setStatus("▶️ Processing resumed", "ok");
    applySettings();
  }
});

// ─── Meter Polling ───

let meterInterval = null;

function startMeterPolling() {
  stopMeterPolling();
  meterInterval = setInterval(async () => {
    try {
      const result = await sendMessage({ type: "GET_ANALYZER_DATA" });
      if (result.success && result.data) {
        const { rms, peak: pk, compReduction, limitReduction } = result.data;
        levelBar.style.width = Math.min(100, rms * 100) + "%";
        levelPct.textContent = Math.round(rms * 100) + "%";

        const compAbs = Math.abs(compReduction || 0);
        compBar.style.width = Math.min(100, compAbs * 3) + "%";
        compVal.textContent = compAbs < 0.5 ? "—" : compReduction.toFixed(1) + "dB";

        const limitAbs = Math.abs(limitReduction || 0);
        limitBar.style.width = Math.min(100, limitAbs * 5) + "%";
        limitVal.textContent = limitAbs < 0.5 ? "clean" : limitReduction.toFixed(1) + "dB";
      }
    } catch {}
  }, 80);
}

function stopMeterPolling() {
  if (meterInterval) {
    clearInterval(meterInterval);
    meterInterval = null;
  }
}

// ─── Settings Persistence ───

function saveSettings() {
  try {
    chrome.storage.local.set({ vcpSettings: settings });
  } catch {}
}

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get("vcpSettings");
    if (data.vcpSettings) {
      settings = { ...settings, ...data.vcpSettings };
      // Restore UI
      volumeSlider.value = settings.masterVolume;
      volValue.textContent = settings.masterVolume + "%";
      claritySlider.value = settings.clarityAmount;
      clarityVal.textContent = settings.clarityAmount;
      noiseSlider.value = settings.noiseGateAmount;
      noiseVal.textContent = settings.noiseGateAmount;
      deEsserSlider.value = settings.deEsserAmount;
      deEsserVal.textContent = settings.deEsserAmount;
      threshSlider.value = settings.compThreshold;
      threshVal.textContent = settings.compThreshold + "dB";
      ratioSlider.value = settings.compRatio;
      ratioVal.textContent = settings.compRatio + ":1";
      compToggle.classList.toggle("active", settings.compressorOn);
      limiterToggle.classList.toggle("active", settings.limiterOn);
      EQ_BANDS.forEach((band) => {
        updateEQDisplay(band.id, settings.eqBands[band.id] || 0);
      });
    }
  } catch {}
}

// ─── Check Initial Status ───

async function checkStatus() {
  const result = await sendMessage({ type: "GET_STATUS" });
  if (result.success && result.isActive) {
    isActive = true;
    setStatus("🎵 Audio is being enhanced (session active)", "ok");
    startBtn.textContent = "⏹ Stop Processing";
    startBtn.classList.add("stop");
    liveDot.classList.remove("hidden");
    bypassBtn.classList.remove("hidden");
    antiDoubleNote.classList.remove("hidden");
    metersSection.classList.remove("hidden");
    document.querySelectorAll(".source-btn").forEach(b => b.disabled = true);
    startMeterPolling();
  }
}

// ─── Initialize ───

async function init() {
  buildEQGrid();
  await loadSettings();
  await checkStatus();
  setStatus("Ready — select source and start", "info");
}

// Listen for stream ended from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STREAM_ENDED") {
    stopCapture();
    setStatus("⏹ Stream ended (tab sharing stopped)", "info");
  }
});

// Auto-save on settings change
const autoSave = () => {
  clearTimeout(autoSave._t);
  autoSave._t = setTimeout(saveSettings, 1000);
};

// Wire up auto-save to all sliders
document.querySelectorAll('input[type="range"]').forEach(slider => {
  slider.addEventListener("input", autoSave);
});
document.querySelectorAll(".toggle-btn").forEach(btn => {
  btn.addEventListener("click", autoSave);
});

// Cleanup on popup close
window.addEventListener("beforeunload", () => {
  stopMeterPolling();
});

init();

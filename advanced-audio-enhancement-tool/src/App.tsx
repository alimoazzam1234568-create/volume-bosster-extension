import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AudioEngine,
  AudioSettings,
  defaultSettings,
  PRESETS,
  EQ_BAND_DEFS,
  CaptureSource,
} from "./engine/AudioEngine";
import SpectrumVisualizer, { VizMode } from "./components/SpectrumVisualizer";
import AdvancedKnob from "./components/AdvancedKnob";
import Fader from "./components/Fader";
import VUMeter from "./components/VUMeter";
import Toggle, { MiniToggle } from "./components/Toggle";
import Section from "./components/Section";
import CaptureGuide from "./components/CaptureGuide";

type PageId = "capture" | "enhance" | "eq" | "dynamics" | "effects" | "presets";

const PAGES: { id: PageId; label: string; icon: string }[] = [
  { id: "capture", label: "Capture", icon: "📡" },
  { id: "enhance", label: "Enhance", icon: "✨" },
  { id: "eq", label: "EQ", icon: "🎛️" },
  { id: "dynamics", label: "Dynamics", icon: "🗜️" },
  { id: "effects", label: "Effects", icon: "🌐" },
  { id: "presets", label: "Presets", icon: "💾" },
];

const SOURCES: { id: CaptureSource; label: string; icon: string; desc: string }[] = [
  { id: "tab", label: "Browser Tab", icon: "🌐", desc: "YouTube, Spotify, any tab" },
  { id: "window", label: "Window", icon: "🪟", desc: "Any app window audio" },
  { id: "screen", label: "Full Screen", icon: "🖥️", desc: "Entire display audio" },
  { id: "mic", label: "Microphone", icon: "🎙️", desc: "Live voice input" },
];

export default function App() {
  const engine = useRef(new AudioEngine());
  const animRef = useRef(0);

  const [settings, setSettings] = useState<AudioSettings>({ ...defaultSettings });
  const [isActive, setIsActive] = useState(false);
  const [captureSource, setCaptureSource] = useState<CaptureSource>("tab");
  const [activePage, setActivePage] = useState<PageId>("capture");
  const [vizMode, setVizMode] = useState<VizMode>("spectrum");
  const [rms, setRms] = useState(0);
  const [peak, setPeak] = useState(0);
  const [compGR, setCompGR] = useState(0);
  const [limitGR, setLimitGR] = useState(0);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [status, setStatus] = useState("Select a source and start enhancement");
  const [statusType, setStatusType] = useState<"info" | "ok" | "err" | "warn">("info");
  const [showGuide, setShowGuide] = useState(false);
  const [isBypassed, setIsBypassed] = useState(false);

  // Throttled meter updates
  const lastMeterUpdate = useRef(0);
  const updateMeters = useCallback(() => {
    const now = performance.now();
    if (now - lastMeterUpdate.current < 50) {
      animRef.current = requestAnimationFrame(updateMeters);
      return;
    }
    lastMeterUpdate.current = now;
    const e = engine.current;
    if (e.isProcessing()) {
      setRms(e.getRMSLevel());
      setPeak(e.getPeakLevel());
      setCompGR(e.getCompressorReduction());
      setLimitGR(e.getLimiterReduction());
    }
    animRef.current = requestAnimationFrame(updateMeters);
  }, []);

  const getData = useCallback(() => engine.current.getAnalyserData(), []);

  // Stream ended handler
  const handleEnded = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    setIsActive(false);
    setRms(0);
    setPeak(0);
    setCompGR(0);
    setLimitGR(0);
    setStatus("⏹ Audio source stopped (sharing ended). Ready to start again.");
    setStatusType("info");
  }, []);

  useEffect(() => {
    const e = engine.current;
    e.onStreamEnded = handleEnded;
    return () => {
      cancelAnimationFrame(animRef.current);
      e.onStreamEnded = null;
      e.destroy();
    };
  }, [handleEnded]);

  // Keep settings ref for async access
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const update = useCallback(
    <K extends keyof AudioSettings>(key: K, val: AudioSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: val };
        if (engine.current.isProcessing() && !isBypassed) {
          engine.current.applySettings(next);
        }
        return next;
      });
      setActivePreset(null);
    },
    [isBypassed]
  );

  const updateEQ = useCallback(
    (bandId: string, gain: number) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          eqBands: { ...prev.eqBands, [bandId]: gain },
        };
        if (engine.current.isProcessing() && !isBypassed) {
          engine.current.applySettings(next);
        }
        return next;
      });
      setActivePreset(null);
    },
    [isBypassed]
  );

  // Start capture
  const startCapture = async () => {
    const e = engine.current;
    setStatus("Setting up audio capture...");
    setStatusType("info");

    try {
      switch (captureSource) {
        case "tab":
          await e.captureTab();
          break;
        case "window":
          await e.captureWindow();
          break;
        case "screen":
          await e.captureScreen();
          break;
        case "mic":
          await e.captureMic();
          break;
      }

      await e.buildChain(settingsRef.current);
      setIsActive(true);
      setStatusType("ok");
      setStatus(
        `🎵 ${SOURCES.find((s) => s.id === captureSource)?.label || captureSource} captured — audio is being enhanced live`
      );
      setActivePage("enhance");
      animRef.current = requestAnimationFrame(updateMeters);
    } catch (err: any) {
      setStatusType("err");
      setStatus(err.message || "Capture failed. Check permissions and try again.");
      setIsActive(false);
    }
  };

  const stopCapture = () => {
    cancelAnimationFrame(animRef.current);
    engine.current.stop();
    // onStreamEnded callback fires
  };

  const bypass = () => {
    setIsBypassed((prev) => {
      const next = !prev;
      if (engine.current.isProcessing()) {
        if (next) {
          engine.current.applySettings({
            ...defaultSettings,
            masterVolume: 100,
            compressorOn: false,
            clarityOn: false,
            noiseGateOn: false,
            deEsserOn: false,
            reverbOn: false,
          });
          setStatus("⏸ Bypass ON — raw unprocessed audio");
          setStatusType("warn");
        } else {
          engine.current.applySettings(settingsRef.current);
          setStatus("▶️ Processing resumed");
          setStatusType("ok");
        }
      }
      return next;
    });
  };

  const applyPreset = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (!preset) return;
    const merged = { ...defaultSettings, ...preset.settings };
    // Deep merge eqBands
    if (preset.settings.eqBands) {
      merged.eqBands = { ...defaultSettings.eqBands, ...preset.settings.eqBands };
    }
    setSettings(merged);
    setActivePreset(name);
    if (engine.current.isProcessing() && !isBypassed) {
      engine.current.applySettings(merged);
    }
    setStatus(`✅ Applied preset: ${preset.icon} ${preset.name}`);
    setStatusType("ok");
  };

  const resetAll = () => {
    setSettings({ ...defaultSettings });
    setActivePreset(null);
    if (engine.current.isProcessing()) {
      engine.current.applySettings(defaultSettings);
    }
    setStatus("Settings reset to defaults");
    setStatusType("info");
  };

  const statusColors = {
    info: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    ok: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    err: "bg-red-500/10 text-red-300 border-red-500/20",
    warn: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  };

  const reverbPresets = [
    { id: "small", label: "Small Room", icon: "🏠" },
    { id: "room", label: "Medium Room", icon: "🏡" },
    { id: "hall", label: "Concert Hall", icon: "🎭" },
    { id: "cathedral", label: "Cathedral", icon: "⛪" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white overflow-x-hidden">
      {/* ── Header ── */}
      <header className="border-b border-white/5 backdrop-blur-2xl bg-slate-950/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="relative"
              animate={isActive ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-600 flex items-center justify-center text-lg shadow-lg shadow-violet-500/25">
                🔊
              </div>
              {isActive && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ boxShadow: "0 0 10px #22c55e80" }}
                />
              )}
            </motion.div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                Volume Corrector Pro
              </h1>
              <p className="text-[9px] text-slate-500 uppercase tracking-[0.2em]">
                Advanced Audio Enhancement Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActive && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={bypass}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                  isBypassed
                    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                    : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:bg-slate-700"
                }`}
              >
                {isBypassed ? "⏸ BYPASSED" : "🔀 Bypass"}
              </motion.button>
            )}
            <button
              onClick={resetAll}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:bg-slate-700 transition-all"
            >
              ↺ Reset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Status */}
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={`rounded-xl border px-4 py-2.5 text-xs font-medium transition-all ${statusColors[statusType]}`}
          >
            {status}
          </motion.div>
        </AnimatePresence>

        {/* Anti-double notice */}
        {isActive && captureSource !== "mic" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border px-4 py-2 text-[10px] font-medium bg-violet-500/8 text-violet-300/80 border-violet-500/15 flex items-center gap-2"
          >
            <span>🛡️</span>
            <span>
              Anti-doubling active — original audio is suppressed. Only the processed, single-stream output reaches your speakers.
            </span>
          </motion.div>
        )}

        {/* ── Top Row: Capture Controls + Visualizer ── */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Source & Controls */}
          <div className="xl:col-span-1 space-y-3">
            <Section title="Audio Source" icon="📡" compact>
              <div className="space-y-1.5">
                {SOURCES.map((src) => (
                  <button
                    key={src.id}
                    onClick={() => !isActive && setCaptureSource(src.id)}
                    disabled={isActive}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                      captureSource === src.id
                        ? "bg-violet-500/15 border-violet-500/30 shadow-sm shadow-violet-500/10"
                        : "bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/60"
                    } ${isActive ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{src.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{src.label}</p>
                        <p className="text-[10px] text-slate-400 truncate">{src.desc}</p>
                      </div>
                      {captureSource === src.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Guide toggle */}
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] text-violet-400 hover:bg-violet-500/10 transition-all"
              >
                {showGuide ? "▾ Hide" : "▸ How to capture"} audio
              </button>

              {showGuide && <CaptureGuide source={captureSource} />}

              {/* Main CTA */}
              <motion.button
                onClick={isActive ? stopCapture : startCapture}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 rounded-xl font-bold text-xs transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/25"
                    : "bg-gradient-to-r from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/25"
                }`}
                style={
                  !isActive
                    ? {
                        boxShadow: "0 0 25px rgba(139, 92, 246, 0.3), 0 4px 15px rgba(0,0,0,0.2)",
                        animation: "pulse-glow 2s ease-in-out infinite",
                      }
                    : {}
                }
              >
                {isActive ? "⏹ Stop Processing" : "▶️ Start Audio Enhancement"}
              </motion.button>

              {/* Live stats */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/30 text-center">
                    <p className="text-[8px] text-slate-500 uppercase">Comp</p>
                    <p className="text-xs font-bold text-orange-400">
                      {compGR < -0.5 ? `${compGR.toFixed(1)}dB` : "—"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/30 text-center">
                    <p className="text-[8px] text-slate-500 uppercase">Limit</p>
                    <p className="text-xs font-bold text-rose-400">
                      {limitGR < -0.1 ? `${limitGR.toFixed(1)}dB` : "✓"}
                    </p>
                  </div>
                </motion.div>
              )}
            </Section>
          </div>

          {/* Visualizer */}
          <div className="xl:col-span-3 space-y-3">
            <Section
              title="Audio Visualizer"
              icon="📊"
              headerRight={
                <div className="flex gap-0.5">
                  {(["spectrum", "waveform", "circle", "waterfall"] as VizMode[]).map(
                    (m) => (
                      <button
                        key={m}
                        onClick={() => setVizMode(m)}
                        className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                          vizMode === m
                            ? "bg-violet-500/25 text-violet-300"
                            : "text-slate-500 hover:text-slate-400 hover:bg-slate-800"
                        }`}
                      >
                        {m === "spectrum"
                          ? "▮▮"
                          : m === "waveform"
                          ? "〜"
                          : m === "circle"
                          ? "◎"
                          : "▨"}
                      </button>
                    )
                  )}
                </div>
              }
            >
              <div className="h-[220px] rounded-xl overflow-hidden">
                <SpectrumVisualizer
                  getData={getData}
                  isActive={isActive}
                  mode={vizMode}
                  color="#8b5cf6"
                />
              </div>

              {/* VU Meters */}
              <div className="flex items-center gap-5 pt-1">
                <VUMeter level={rms} peak={peak} isActive={isActive} label="RMS" height={64} />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-widest">
                    <span>Output Level</span>
                    <span className="font-bold text-white">{Math.round(rms * 100)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-800/60 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: `${Math.min(100, rms * 100)}%` }}
                      transition={{ duration: 0.05 }}
                      style={{
                        background:
                          rms > 0.8
                            ? "linear-gradient(90deg, #22c55e, #eab308, #ef4444)"
                            : rms > 0.5
                            ? "linear-gradient(90deg, #22c55e, #eab308)"
                            : "linear-gradient(90deg, #22c55e, #22c55e)",
                        boxShadow: "0 0 10px rgba(34, 197, 94, 0.3)",
                      }}
                    />
                  </div>

                  {/* Limiter catch alert */}
                  {limitGR < -1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-1.5 pt-0.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-[9px] text-rose-400 font-medium">
                        Limiter catching peaks ({limitGR.toFixed(1)} dB) — clipping prevented
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            </Section>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div className="flex gap-1 bg-slate-900/50 backdrop-blur-xl rounded-xl border border-white/5 p-1 overflow-x-auto">
          {PAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePage(p.id)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activePage === p.id
                  ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-white border border-violet-500/25"
                  : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/40"
              }`}
            >
              <span className="text-sm">{p.icon}</span>
              <span className="hidden sm:inline">{p.label}</span>
            </button>
          ))}
        </div>

        {/* ── Pages ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activePage === "capture" && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                <motion.div
                  className="text-6xl"
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 2, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                >
                  {SOURCES.find((s) => s.id === captureSource)?.icon}
                </motion.div>
                <div>
                  <h2 className="text-xl font-bold text-white">Ready to Enhance Audio</h2>
                  <p className="text-sm text-slate-400 mt-1 max-w-md">
                    Select a source above and click{" "}
                    <strong className="text-violet-300">Start Audio Enhancement</strong> to
                    capture and process audio from any tab, window, screen, or your microphone
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
                  {[
                    { icon: "🛡️", label: "No Doubling", desc: "Single output stream" },
                    { icon: "🧱", label: "Limiter", desc: "Anti-clip protection" },
                    { icon: "🎛️", label: "5-Band EQ", desc: "Professional control" },
                    { icon: "🌊", label: "Smooth", desc: "Click-free changes" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30"
                    >
                      <span className="text-2xl">{f.icon}</span>
                      <p className="text-[11px] font-bold text-white mt-1">{f.label}</p>
                      <p className="text-[9px] text-slate-500">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePage === "enhance" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Master Volume */}
                <Section title="Master Volume" icon="🔊">
                  <div className="flex items-center justify-center py-3">
                    <AdvancedKnob
                      value={settings.masterVolume}
                      min={0}
                      max={500}
                      step={5}
                      label="Master"
                      unit="%"
                      onChange={(v) => update("masterVolume", v)}
                      color="#8b5cf6"
                      size={130}
                    />
                  </div>

                  <Fader
                    value={settings.masterVolume}
                    min={0}
                    max={500}
                    step={5}
                    label="Volume"
                    unit="%"
                    icon="🔊"
                    color="#8b5cf6"
                    onChange={(v) => update("masterVolume", v)}
                  />

                  <div className="grid grid-cols-5 gap-1.5">
                    {[50, 100, 150, 250, 400].map((vol) => (
                      <button
                        key={vol}
                        onClick={() => update("masterVolume", vol)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                          settings.masterVolume === vol
                            ? "bg-violet-500/25 text-violet-300 border border-violet-500/30"
                            : "bg-slate-800/60 text-slate-400 border border-slate-700/40 hover:bg-slate-700"
                        }`}
                      >
                        {vol}%
                      </button>
                    ))}
                  </div>

                  {settings.masterVolume > 200 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/15"
                    >
                      <span>⚠️</span>
                      <p className="text-[10px] text-yellow-300">
                        Volume above 200% — limiter is protecting from clipping. Use dynamics for clean highs.
                      </p>
                    </motion.div>
                  )}
                </Section>

                {/* Clarity & Fix */}
                <Section title="Voice Enhancement" icon="✨">
                  <div className="space-y-4">
                    <div>
                      <MiniToggle
                        label="Clarity"
                        checked={settings.clarityOn}
                        onChange={(on) => update("clarityOn", on)}
                        color="#22c55e"
                      />
                      <Fader
                        value={settings.clarityAmount}
                        min={0}
                        max={100}
                        label="Clarity Enhancement"
                        unit="%"
                        icon="🔍"
                        color="#22c55e"
                        onChange={(v) => update("clarityAmount", v)}
                      />
                    </div>

                    <div>
                      <MiniToggle
                        label="Noise Gate"
                        checked={settings.noiseGateOn}
                        onChange={(on) => update("noiseGateOn", on)}
                        color="#eab308"
                      />
                      <Fader
                        value={settings.noiseGateAmount}
                        min={0}
                        max={100}
                        label="Noise Gate (Fix Grinding)"
                        unit="%"
                        icon="🔇"
                        color="#eab308"
                        onChange={(v) => update("noiseGateAmount", v)}
                      />
                    </div>

                    <div>
                      <MiniToggle
                        label="De-Esser"
                        checked={settings.deEsserOn}
                        onChange={(on) => update("deEsserOn", on)}
                        color="#06b6d4"
                      />
                      <Fader
                        value={settings.deEsserAmount}
                        min={0}
                        max={100}
                        label="De-Esser (Fix Harsh)"
                        unit="%"
                        icon="🎯"
                        color="#06b6d4"
                        onChange={(v) => update("deEsserAmount", v)}
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/8 to-fuchsia-500/8 border border-violet-500/15">
                      <h4 className="text-[10px] font-bold text-violet-300 mb-1.5">💡 Quick Fix Guide</h4>
                      <ul className="text-[10px] text-slate-400 space-y-0.5">
                        <li>• <strong className="text-emerald-300">Unclear audio?</strong> Push Noise Gate to 50-70% + Clarity 70%+</li>
                        <li>• <strong className="text-yellow-300">Grinding/buzzing?</strong> Noise Gate 60%+ and enable De-Esser</li>
                        <li>• <strong className="text-cyan-300">Harsh "s" sounds?</strong> Increase De-Esser to 50%+</li>
                        <li>• <strong className="text-purple-300">Too quiet?</strong> Crank Master to 200-400% — limiter keeps it clean</li>
                      </ul>
                    </div>
                  </div>
                </Section>
              </div>
            )}

            {activePage === "eq" && (
              <div className="space-y-4">
                <Section title="5-Band Parametric Equalizer" icon="🎛️">
                  {/* Visual EQ */}
                  <div className="h-36 rounded-xl bg-slate-950/50 border border-white/5 relative overflow-hidden p-3">
                    {/* Grid */}
                    <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none">
                      {[-15, -7.5, 0, 7.5, 15].map((db) => (
                        <div key={db} className="flex items-center gap-2">
                          <span className="text-[8px] text-slate-600 w-8 text-right tabular-nums">
                            {db > 0 ? `+${db}` : db}dB
                          </span>
                          <div className="flex-1 h-px bg-slate-800/30" />
                        </div>
                      ))}
                    </div>

                    {/* EQ curve */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 120" preserveAspectRatio="none">
                      <path
                        d={(() => {
                          const pts = EQ_BAND_DEFS.map((b, i) => {
                            const x = 30 + (i / (EQ_BAND_DEFS.length - 1)) * 540;
                            const y = 60 - ((settings.eqBands[b.id] ?? 0) / 15) * 35;
                            return [x, y];
                          });
                          let d = `M ${pts[0][0]},${pts[0][1]}`;
                          for (let i = 1; i < pts.length; i++) {
                            const [px, py] = pts[i];
                            const [prevX, prevY] = pts[i - 1];
                            d += ` Q ${(prevX + px) / 2} ${(prevY + py) / 2}, ${px} ${py}`;
                          }
                          return d;
                        })()}
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="2.5"
                        opacity="0.9"
                        strokeLinecap="round"
                      />
                      {/* Fill */}
                      <path
                        d={(() => {
                          const pts = EQ_BAND_DEFS.map((b, i) => {
                            const x = 30 + (i / (EQ_BAND_DEFS.length - 1)) * 540;
                            const y = 60 - ((settings.eqBands[b.id] ?? 0) / 15) * 35;
                            return [x, y];
                          });
                          let d = `M ${pts[0][0]},${pts[0][1]}`;
                          for (let i = 1; i < pts.length; i++) {
                            d += ` Q ${(pts[i - 1][0] + pts[i][0]) / 2} ${(pts[i - 1][1] + pts[i][1]) / 2}, ${pts[i][0]} ${pts[i][1]}`;
                          }
                          d += ` L 600 120 L 0 120 Z`;
                          return d;
                        })()}
                        fill="url(#eqGrad)"
                        opacity="0.1"
                      />
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="transparent" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Band labels */}
                    <div className="absolute bottom-1 left-0 right-0 flex justify-around px-4">
                      {EQ_BAND_DEFS.map((b) => (
                        <span key={b.id} className="text-[8px]" style={{ color: b.color }}>
                          {b.frequency >= 1000 ? `${(b.frequency / 1000).toFixed(1)}kHz` : `${b.frequency}Hz`}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Faders */}
                  <div className="flex justify-around gap-2 overflow-x-auto py-2">
                    {EQ_BAND_DEFS.map((band) => (
                      <Fader
                        key={band.id}
                        value={settings.eqBands[band.id] ?? 0}
                        min={-15}
                        max={15}
                        step={0.5}
                        label={band.label}
                        unit=" dB"
                        color={band.color}
                        vertical
                        onChange={(v) => updateEQ(band.id, v)}
                      />
                    ))}
                  </div>

                  {/* Quick presets */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "Flat", bands: { sub: 0, bass: 0, lowMid: 0, presence: 0, air: 0 } },
                      { label: "V-Shape", bands: { sub: 6, bass: 4, lowMid: -3, presence: 6, air: 4 } },
                      { label: "Vocal", bands: { sub: -2, bass: -1, lowMid: 5, presence: 4, air: 1 } },
                      { label: "Bass Drop", bands: { sub: 10, bass: 6, lowMid: 0, presence: -2, air: -3 } },
                    ].map((q) => (
                      <button
                        key={q.label}
                        onClick={() => {
                          EQ_BAND_DEFS.forEach((b) => {
                            updateEQ(b.id, q.bands[b.id as keyof typeof q.bands] ?? 0);
                          });
                        }}
                        className="py-1.5 rounded-lg text-[10px] font-semibold bg-slate-800/60 text-slate-400 border border-slate-700/40 hover:bg-slate-700 transition-all"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </Section>
              </div>
            )}

            {activePage === "dynamics" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Compressor */}
                <Section
                  title="Dynamic Compressor"
                  icon="🗜️"
                  headerRight={
                    <MiniToggle
                      label=""
                      checked={settings.compressorOn}
                      onChange={(on) => update("compressorOn", on)}
                      color="#f97316"
                    />
                  }
                >
                  <p className="text-[10px] text-slate-500">
                    Smoothly evens loud/quiet parts for consistent volume
                  </p>

                  <div className="grid grid-cols-2 gap-4 justify-items-center py-2">
                    <AdvancedKnob
                      value={settings.compThreshold}
                      min={-60}
                      max={0}
                      step={1}
                      label="Threshold"
                      unit="dB"
                      onChange={(v) => update("compThreshold", v)}
                      color="#f97316"
                      size={90}
                    />
                    <AdvancedKnob
                      value={settings.compRatio}
                      min={1}
                      max={20}
                      step={0.5}
                      label="Ratio"
                      unit=":1"
                      onChange={(v) => update("compRatio", v)}
                      color="#f97316"
                      size={90}
                    />
                  </div>

                  <Fader
                    value={settings.compThreshold}
                    min={-60}
                    max={0}
                    label="Threshold"
                    unit=" dB"
                    icon="📏"
                    color="#f97316"
                    onChange={(v) => update("compThreshold", v)}
                  />

                  <Fader
                    value={settings.compRatio}
                    min={1}
                    max={20}
                    step={0.5}
                    label="Ratio"
                    unit=":1"
                    icon="📐"
                    color="#f97316"
                    onChange={(v) => update("compRatio", v)}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Fader
                      value={settings.compAttack}
                      min={0.001}
                      max={0.5}
                      step={0.001}
                      label="Attack"
                      unit=" s"
                      icon="⚡"
                      color="#fbbf24"
                      onChange={(v) => update("compAttack", v)}
                    />
                    <Fader
                      value={settings.compRelease}
                      min={0.01}
                      max={1}
                      step={0.01}
                      label="Release"
                      unit=" s"
                      icon="🔄"
                      color="#fbbf24"
                      onChange={(v) => update("compRelease", v)}
                    />
                  </div>

                  {/* GR meter */}
                  {isActive && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span>Gain Reduction</span>
                        <span className="text-orange-400 font-bold">
                          {compGR < -0.5 ? `${compGR.toFixed(1)} dB` : "—"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-orange-500"
                          animate={{ width: `${Math.min(100, Math.abs(compGR) * 3)}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    </div>
                  )}
                </Section>

                {/* Limiter */}
                <Section
                  title="Brick-Wall Limiter"
                  icon="🧱"
                  headerRight={
                    <MiniToggle
                      label=""
                      checked={settings.limiterOn}
                      onChange={(on) => update("limiterOn", on)}
                      color="#ef4444"
                    />
                  }
                >
                  <p className="text-[10px] text-slate-500">
                    Absolute ceiling — output never exceeds this level, preventing ALL distortion
                  </p>

                  <div className="flex justify-center py-3">
                    <AdvancedKnob
                      value={settings.limiterCeiling}
                      min={-6}
                      max={0}
                      step={0.5}
                      label="Ceiling"
                      unit="dB"
                      onChange={(v) => update("limiterCeiling", v)}
                      color="#ef4444"
                      size={100}
                    />
                  </div>

                  <Fader
                    value={settings.limiterCeiling}
                    min={-6}
                    max={0}
                    step={0.5}
                    label="Ceiling Level"
                    unit=" dB"
                    icon="📏"
                    color="#ef4444"
                    onChange={(v) => update("limiterCeiling", v)}
                  />

                  <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/8 to-rose-500/8 border border-red-500/15">
                    <h4 className="text-[10px] font-bold text-rose-300 mb-1">🧱 How the Limiter Works</h4>
                    <ul className="text-[10px] text-slate-400 space-y-0.5">
                      <li>• Set to <strong className="text-red-300">-1 dB</strong> for standard output</li>
                      <li>• Lower ceiling = more headroom but slightly quieter</li>
                      <li>• Higher volume = limiter catches more peaks (watch GR meter)</li>
                      <li>• The limiter runs <strong className="text-red-300">after</strong> all other processing</li>
                    </ul>
                  </div>

                  {/* Limit GR meter */}
                  {isActive && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span>Limited Peaks</span>
                        <span className="text-rose-400 font-bold">
                          {limitGR < -0.5 ? `${limitGR.toFixed(1)} dB` : "clean"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-rose-500"
                          animate={{ width: `${Math.min(100, Math.abs(limitGR) * 5)}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    </div>
                  )}
                </Section>
              </div>
            )}

            {activePage === "effects" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Stereo */}
                <Section title="Stereo & Width" icon="🌐">
                  <Fader
                    value={settings.stereoWidth}
                    min={0}
                    max={200}
                    step={5}
                    label="Stereo Width"
                    unit="%"
                    icon="↔️"
                    color="#ec4899"
                    onChange={(v) => update("stereoWidth", v)}
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 -mt-1">
                    <span>Mono</span>
                    <span>Normal</span>
                    <span>Ultra Wide</span>
                  </div>

                  {/* Visual width indicator */}
                  <div className="h-3 rounded-full bg-slate-800/60 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 rounded-full bg-gradient-to-r from-pink-500/30 to-pink-500/60 transition-all duration-200"
                      style={{
                        left: `${50 - (settings.stereoWidth / 200) * 50}%`,
                        width: `${(settings.stereoWidth / 200) * 100}%`,
                      }}
                    />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                  </div>

                  <p className="text-[10px] text-slate-500">
                    Widens the stereo field using Mid/Side processing. 100% = original width.
                  </p>
                </Section>

                {/* Reverb */}
                <Section
                  title="Reverb & Ambience"
                  icon="🏛️"
                  headerRight={
                    <MiniToggle
                      label=""
                      checked={settings.reverbOn}
                      onChange={(on) => update("reverbOn", on)}
                      color="#8b5cf6"
                    />
                  }
                >
                  <Fader
                    value={settings.reverbMix}
                    min={0}
                    max={100}
                    label="Reverb Mix"
                    unit="%"
                    icon="🏛️"
                    color="#8b5cf6"
                    onChange={(v) => update("reverbMix", v)}
                  />

                  <div className="grid grid-cols-4 gap-1.5">
                    {reverbPresets.map((rp) => (
                      <button
                        key={rp.id}
                        onClick={() => update("reverbPreset", rp.id)}
                        className={`py-2 rounded-lg text-[10px] font-semibold transition-all border ${
                          settings.reverbPreset === rp.id
                            ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                            : "bg-slate-800/60 text-slate-400 border-slate-700/40 hover:bg-slate-700"
                        }`}
                      >
                        <span className="block text-sm">{rp.icon}</span>
                        {rp.label}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-500">
                    Adds room ambience using convolution reverb. Lower mix for speech, higher for music.
                  </p>
                </Section>

                {/* Smoothing & Advanced */}
                <div className="lg:col-span-2">
                  <Section title="Advanced Controls" icon="⚙️">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Fader
                          value={settings.rampTime}
                          min={0.01}
                          max={0.3}
                          step={0.01}
                          label="Transition Smoothing"
                          unit=" sec"
                          icon="🌊"
                          color="#06b6d4"
                          onChange={(v) => update("rampTime", v)}
                        />
                        <p className="text-[9px] text-slate-600 mt-0.5">
                          Higher = smoother parameter changes (no pops/clicks)
                        </p>
                      </div>

                      <div>
                        <Fader
                          value={settings.compKnee}
                          min={0}
                          max={40}
                          step={1}
                          label="Compressor Knee"
                          unit=" dB"
                          icon="📐"
                          color="#f97316"
                          onChange={(v) => update("compKnee", v)}
                        />
                        <p className="text-[9px] text-slate-600 mt-0.5">
                          Higher knee = softer, more natural compression
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <Toggle
                          label="Compressor"
                          checked={settings.compressorOn}
                          onChange={(on) => update("compressorOn", on)}
                          icon="🗜️"
                          description="Dynamic range control"
                        />
                        <Toggle
                          label="Limiter"
                          checked={settings.limiterOn}
                          onChange={(on) => update("limiterOn", on)}
                          icon="🧱"
                          description="Anti-clip ceiling"
                        />
                        <Toggle
                          label="Reverb"
                          checked={settings.reverbOn}
                          onChange={(on) => update("reverbOn", on)}
                          icon="🏛️"
                          description="Room ambience"
                        />
                      </div>
                    </div>
                  </Section>
                </div>
              </div>
            )}

            {activePage === "presets" && (
              <Section title="Audio Presets" icon="💾">
                <p className="text-[10px] text-slate-500">
                  One-click profiles — all transitions are smooth with zero pops, clicks, or doubling
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {PRESETS.map((preset) => (
                    <motion.button
                      key={preset.name}
                      onClick={() => applyPreset(preset.name)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        activePreset === preset.name
                          ? "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-violet-500/30 shadow-lg shadow-violet-500/10"
                          : "bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/60 hover:border-slate-600"
                      }`}
                    >
                      <div className="text-2xl mb-1.5">{preset.icon}</div>
                      <h4 className="text-xs font-bold text-white">{preset.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</p>
                      {activePreset === preset.name && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-1.5 text-[9px] text-violet-400 font-bold"
                        >
                          ✓ ACTIVE
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Preset details */}
                {activePreset && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-violet-500/8 border border-violet-500/15"
                  >
                    <h4 className="text-[10px] font-bold text-violet-300 mb-2">
                      {PRESETS.find((p) => p.name === activePreset)?.icon}{" "}
                      {activePreset} — Current Values
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {Object.entries(settings).map(([key, val]) => {
                        if (key === "eqBands" || typeof val === "boolean" || typeof val === "string") {
                          return null;
                        }
                        return (
                          <div key={key} className="p-1.5 rounded-lg bg-slate-900/30 text-center">
                            <p className="text-[8px] text-slate-500 uppercase truncate">{key}</p>
                            <p className="text-[10px] font-bold text-white">
                              {typeof val === "number" ? Math.round(val * 100) / 100 : val}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </Section>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Chrome Extension Download ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-6"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-3xl shadow-lg shadow-violet-500/25">
                🧩
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-sm font-bold text-white mb-1">
                Chrome Extension Available
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                Install Volume Corrector Pro as a Chrome extension for one-click access from any tab.
                Works with YouTube, Spotify, and every website. Includes all features.
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-[10px] text-slate-300">
                  <span className="text-emerald-400">✓</span> Free &amp; Open
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-[10px] text-slate-300">
                  <span className="text-emerald-400">✓</span> No Ads
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-[10px] text-slate-300">
                  <span className="text-emerald-400">✓</span> Works Offline
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-left space-y-1.5 text-[10px] text-slate-400">
                <p className="font-bold text-white text-[11px]">📦 Install Steps:</p>
                <p>1. Build this project: <code className="text-violet-300 bg-slate-800 px-1 rounded">npm run build</code></p>
                <p>2. Open Chrome → <code className="text-violet-300 bg-slate-800 px-1 rounded">chrome://extensions</code></p>
                <p>3. Enable <strong className="text-yellow-300">Developer Mode</strong></p>
                <p>4. Click <strong className="text-violet-300">Load unpacked</strong></p>
                <p>5. Select <code className="text-cyan-300 bg-slate-800 px-1 rounded">dist/chrome-extension/</code></p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Feature Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { icon: "🔊", label: "500% Boost", desc: "Clean amplification" },
            { icon: "🛡️", label: "No Doubling", desc: "Anti-double output" },
            { icon: "🧩", label: "Chrome Extension", desc: "Install to browser" },
            { icon: "🎛️", label: "5-Band EQ", desc: "Pro frequency control" },
            { icon: "🗜️", label: "Compressor", desc: "Dynamic smoothing" },
            { icon: "🧱", label: "Limiter", desc: "Clip protection" },
            { icon: "↔️", label: "Stereo Width", desc: "M/S widening" },
            { icon: "📊", label: "Live Meters", desc: "RMS + Peak + GR" },
          ].map((f) => (
            <motion.div
              key={f.label}
              className="p-2.5 rounded-xl bg-slate-900/30 border border-white/5 hover:border-violet-500/15 transition-all"
              whileHover={{ y: -2 }}
            >
              <span className="text-lg">{f.icon}</span>
              <h4 className="text-[11px] font-bold text-white mt-1">{f.label}</h4>
              <p className="text-[9px] text-slate-500">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-5 mt-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[10px] text-slate-600">
            🔊 Volume Corrector Pro — Capture any tab, window, or screen. Real-time enhancement with zero doubling.
          </p>
          <p className="text-[9px] text-slate-700 mt-1">
            Web Audio API • Anti-doubling • Brick-wall limiter • Smooth transitions • Works best in Chrome/Edge
          </p>
        </div>
      </footer>
    </div>
  );
}

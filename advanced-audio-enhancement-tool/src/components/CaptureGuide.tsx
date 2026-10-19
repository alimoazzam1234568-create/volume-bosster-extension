import { CaptureSource } from "../engine/AudioEngine";

interface Props {
  source: CaptureSource;
}

export default function CaptureGuide({ source }: Props) {
  if (source === "tab") {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-violet-500/8 border border-violet-500/15">
          <p className="text-[11px] text-violet-300 font-semibold mb-1.5">
            📋 To capture a browser tab:
          </p>
          <ol className="text-[10px] text-slate-400 space-y-1 list-decimal list-inside">
            <li>Click <strong className="text-white">Start Capture</strong></li>
            <li>In the popup, select the <strong className="text-violet-300">Tab</strong> option at the top</li>
            <li>Choose the tab playing audio (YouTube, Spotify, etc.)</li>
            <li>
              <span className="text-yellow-400 font-bold">⚠ Important:</span> Check the{" "}
              <strong className="text-yellow-300">"Share tab audio"</strong> checkbox
            </li>
            <li>Click <strong className="text-white">Share</strong> — only enhanced audio plays</li>
          </ol>
        </div>
        <p className="text-[10px] text-slate-600 text-center">
          Original tab audio is automatically suppressed to prevent doubling
        </p>
      </div>
    );
  }

  if (source === "window" || source === "screen") {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-violet-500/8 border border-violet-500/15">
          <p className="text-[11px] text-violet-300 font-semibold mb-1.5">
            📋 To capture a window or screen:
          </p>
          <ol className="text-[10px] text-slate-400 space-y-1 list-decimal list-inside">
            <li>Click <strong className="text-white">Start Capture</strong></li>
            <li>Select <strong className="text-violet-300">"Entire Screen"</strong> or <strong className="text-violet-300">"Window"</strong></li>
            <li>Choose what you want to capture</li>
            <li>
              <span className="text-yellow-400 font-bold">⚠ Important:</span> Enable{" "}
              <strong className="text-yellow-300">"Share audio"</strong> / system audio
            </li>
            <li>Click <strong className="text-white">Share</strong> to start processing</li>
          </ol>
        </div>
        <p className="text-[10px] text-slate-600 text-center">
          Captures all audio from the selected window/screen — no doubling
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-violet-500/8 border border-violet-500/15">
        <p className="text-[11px] text-violet-300 font-semibold mb-1.5">
          📋 To capture your microphone:
        </p>
        <ol className="text-[10px] text-slate-400 space-y-1 list-decimal list-inside">
          <li>Click <strong className="text-white">Start Capture</strong></li>
          <li>Allow microphone access when prompted</li>
          <li>Speak clearly — processing happens in real time</li>
        </ol>
      </div>
      <p className="text-[10px] text-slate-600 text-center">
        Echo cancellation + noise suppression are auto-enabled
      </p>
    </div>
  );
}

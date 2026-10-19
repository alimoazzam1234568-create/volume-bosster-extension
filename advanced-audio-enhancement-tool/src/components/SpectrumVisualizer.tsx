import { useEffect, useRef, useCallback } from "react";

export type VizMode = "spectrum" | "waveform" | "circle" | "waterfall";

interface Props {
  getData: () => { frequency: Uint8Array; timeDomain: Uint8Array } | null;
  isActive: boolean;
  mode: VizMode;
  color?: string;
}

const MAX_WATERFALL_HISTORY = 128;

export default function SpectrumVisualizer({ getData, isActive, mode, color = "#8b5cf6" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const historyRef = useRef<number[][]>([]);
  const lastSizeRef = useRef({ w: 0, h: 0 });

  // FIX: Reset waterfall history when mode changes away from waterfall
  useEffect(() => {
    if (mode !== "waterfall") {
      historyRef.current.length = 0;
    }
  }, [mode]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w === 0 || h === 0) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    // FIX: Only re-size and reset transform when dimensions actually change
    if (canvas.width !== w * dpr || canvas.height !== h * dpr || lastSizeRef.current.w !== w || lastSizeRef.current.h !== h) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // FIX: Use setTransform instead of scale to prevent accumulate
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastSizeRef.current = { w, h };
    }

    ctx.clearRect(0, 0, w, h);

    // Dark background
    ctx.fillStyle = "rgba(10, 10, 26, 0.7)";
    ctx.fillRect(0, 0, w, h);

    const data = getData();

    if (!isActive || !data) {
      ctx.fillStyle = "rgba(139, 92, 246, 0.12)";
      ctx.font = `500 ${Math.max(11, w / 60)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Start audio to visualize", w / 2, h / 2);
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const { frequency, timeDomain } = data;

    switch (mode) {
      case "spectrum":
        drawSpectrum(ctx, frequency, w, h, color);
        break;
      case "waveform":
        drawWaveform(ctx, timeDomain, w, h, color);
        break;
      case "circle":
        drawCircle(ctx, frequency, w, h, color);
        break;
      case "waterfall":
        drawWaterfall(ctx, frequency, w, h, color, historyRef.current);
        break;
    }

    animRef.current = requestAnimationFrame(draw);
  }, [isActive, mode, color, getData]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      historyRef.current.length = 0;
    };
  }, [draw]);

  // FIX: Canvas uses explicit width/height attrs, CSS only controls display size
  return (
    <canvas
      ref={canvasRef}
      className="block rounded-xl"
      style={{ display: "block", width: "100%", height: "100%" }}
      width={600}
      height={220}
    />
  );
}

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  w: number,
  h: number,
  color: string
) {
  const barCount = Math.min(128, Math.floor(w / 4));
  const barW = Math.max(1, w / barCount);

  const grad = ctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, "#6366f1");
  grad.addColorStop(0.3, color);
  grad.addColorStop(0.7, "#a78bfa");
  grad.addColorStop(1, "#f0abfc");

  for (let i = 0; i < barCount; i++) {
    const lo = Math.floor((i / barCount) * freq.length * 0.6);
    const hi = Math.max(lo + 1, Math.min(freq.length - 1, Math.floor(((i + 1) / barCount) * freq.length * 0.6)));
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += freq[j];
    const val = sum / (hi - lo + 1) / 255;
    const barH = Math.max(1, val * h);

    ctx.fillStyle = grad;
    ctx.fillRect(i * barW + 0.5, h - barH, barW - 1, barH);

    if (val > 0.05) {
      ctx.shadowColor = color;
      ctx.shadowBlur = val * 12;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(i * barW + 0.5, h - barH, barW - 1, 2);
      ctx.shadowBlur = 0;
    }
  }
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  td: Uint8Array,
  w: number,
  h: number,
  color: string
) {
  const len = td.length;
  const sliceW = w / len;

  const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
  fillGrad.addColorStop(0, color + "25");
  fillGrad.addColorStop(1, color + "05");

  // Fill
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  for (let i = 0; i < len; i++) {
    const v = td[i] / 128.0;
    const y = (v * h) / 2;
    ctx.lineTo(i * sliceW, y);
  }
  ctx.lineTo(w, h / 2);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Stroke
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#6366f1");
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, "#a78bfa");

  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  for (let i = 0; i < len; i++) {
    const v = td[i] / 128.0;
    const y = (v * h) / 2;
    ctx.lineTo(i * sliceW, y);
  }
  ctx.lineTo(w, h / 2);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  w: number,
  h: number,
  color: string
) {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 10;
  if (maxR <= 0) return;
  const segments = 180;

  // Glow layers
  for (let layer = 2; layer >= 0; layer--) {
    const alpha = 0.02 * (3 - layer);
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const idx = Math.floor((i / segments) * freq.length * 0.5);
      const val = freq[idx] / 255;
      const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
      const r = maxR * 0.3 + val * maxR * 0.65 + layer * 3;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, "0");
    ctx.fill();
  }

  // Main shape
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const idx = Math.floor((i / segments) * freq.length * 0.5);
    const val = freq[idx] / 255;
    const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
    const r = maxR * 0.3 + val * maxR * 0.65;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
  grad.addColorStop(0, color + "30");
  grad.addColorStop(0.7, color + "10");
  grad.addColorStop(1, color + "05");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = color + "80";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Center
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.12, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWaterfall(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  w: number,
  h: number,
  color: string,
  history: number[][]
) {
  const cols = Math.max(8, Math.floor(w / 2));
  const binCount = freq.length;
  const row: number[] = [];

  for (let i = 0; i < cols; i++) {
    const t = i / cols;
    const idx = Math.floor(Math.pow(binCount * 0.4, t) * t * binCount * 0.4);
    row.push(Math.min(1, (freq[Math.min(idx, binCount - 1)] / 255) * 1.4));
  }

  history.unshift(row);
  if (history.length > MAX_WATERFALL_HISTORY) {
    history.length = MAX_WATERFALL_HISTORY;
  }

  const rowH = h / MAX_WATERFALL_HISTORY;
  for (let r = 0; r < history.length && r < MAX_WATERFALL_HISTORY; r++) {
    const alpha = 1 - r / MAX_WATERFALL_HISTORY;
    const y = r * rowH;
    for (let i = 0; i < cols && i < history[r].length; i++) {
      const v = history[r][i];
      ctx.fillStyle = color + Math.round(v * 180 * alpha).toString(16).padStart(2, "0");
      ctx.fillRect(i * 2, h - y - rowH, 2, rowH + 0.5);
    }
  }
}

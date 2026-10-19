import { useCallback, useRef, useState } from "react";

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  color?: string;
  size?: number;
  onChange: (v: number) => void;
}

export default function AdvancedKnob({
  value,
  min,
  max,
  step = 1,
  label,
  unit = "",
  color = "#8b5cf6",
  size = 80,
  onChange,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const pct = ((value - min) / (max - min)) * 100;
  const angle = -135 + (pct / 100) * 270;

  const handleDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setDragging(true);

      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      startY.current = clientY;
      startVal.current = value;

      const handleMove = (e2: MouseEvent | TouchEvent) => {
        const y = "touches" in e2 ? e2.touches[0].clientY : e2.clientY;
        const delta = startY.current - y;
        const range = max - min;
        const newVal = startVal.current + (delta / 150) * range;
        const clamped = Math.min(max, Math.max(min, newVal));
        onChange(Math.round(clamped / step) * step);
      };

      const handleUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        window.removeEventListener("touchmove", handleMove);
        window.removeEventListener("touchend", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("touchend", handleUp);
    },
    [value, min, max, step, onChange]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -step : step;
      onChange(
        Math.round(Math.min(max, Math.max(min, value + delta)) / step) * step
      );
    },
    [value, min, max, step, onChange]
  );

  const handleDblClick = useCallback(() => {
    const mid = (min + max) / 2;
    onChange(Math.round(mid / step) * step);
  }, [min, max, step, onChange]);

  const r = (size - 12) / 2;
  const arc = Math.PI * r * 1.5; // 270 degrees
  const dashoffset = arc * (1 - pct / 100);

  const formatVal = (v: number) => {
    if (Math.abs(v) >= 100) return Math.round(v).toString();
    if (Math.abs(v) >= 10) return v.toFixed(step < 1 ? 1 : 0);
    return v.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0);
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        className="relative cursor-pointer transition-transform"
        style={{
          width: size,
          height: size,
          transform: dragging ? "scale(1.08)" : "scale(1)",
          transition: "transform 0.15s ease",
        }}
        onMouseDown={handleDown}
        onTouchStart={handleDown}
        onWheel={handleWheel}
        onDoubleClick={handleDblClick}
        title={`${label}: ${formatVal(value)}${unit} — double-click to reset`}
      >
        {/* SVG arc */}
        <svg width={size} height={size} className="absolute inset-0">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="5"
            strokeDasharray={`${arc} ${2 * Math.PI * r}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(135, ${size / 2}, ${size / 2})`}
          />
          {/* Active arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={`${arc} ${2 * Math.PI * r}`}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            transform={`rotate(135, ${size / 2}, ${size / 2})`}
            style={{
              filter: `drop-shadow(0 0 8px ${color}60)`,
              transition: "stroke-dashoffset 0.08s ease",
            }}
          />
          {/* Center dot */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r * 0.35}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        </svg>

        {/* Knob needle */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div
            className="absolute top-3 w-[3px] h-4 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          />
        </div>

        {/* Value */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="text-white font-bold"
            style={{
              fontSize: size > 80 ? 13 : 10,
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}
          >
            {formatVal(value)}
            {unit && (
              <span className="text-slate-400 font-normal" style={{ fontSize: size > 80 ? 9 : 7 }}>
                {unit}
              </span>
            )}
          </span>
        </div>
      </div>

      <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

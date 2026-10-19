interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  icon?: string;
  color?: string;
  vertical?: boolean;
  showValue?: boolean;
  onChange: (v: number) => void;
}

export default function Fader({
  value,
  min,
  max,
  step = 0.1,
  label,
  unit = "",
  icon,
  color = "#8b5cf6",
  vertical = false,
  showValue = true,
  onChange,
}: Props) {
  const pct = ((value - min) / (max - min)) * 100;

  const formatVal = (v: number) => {
    if (Math.abs(v) >= 100) return Math.round(v).toString();
    if (Math.abs(v) >= 10) return v.toFixed(1);
    return v.toFixed(1);
  };

  if (vertical) {
    return (
      <div className="flex flex-col items-center gap-1 min-w-[52px]">
        {showValue && (
          <span className="text-[10px] font-bold tabular-nums text-white leading-none">
            {formatVal(value)}
            <span className="text-slate-500 font-normal text-[8px]">{unit}</span>
          </span>
        )}

        {/* FIX: Use a rotated and wrapped range input — works in all browsers */}
        <div className="relative w-8 h-28 bg-slate-800/60 rounded-lg overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 rounded-b-lg transition-all duration-75 pointer-events-none"
            style={{
              height: `${pct}%`,
              background: `linear-gradient(to top, ${color}, ${color}aa)`,
              boxShadow: `0 0 12px ${color}30`,
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute opacity-0 cursor-pointer"
            style={{
              width: "112px",
              height: "32px",
              transform: "rotate(-90deg)",
              transformOrigin: "center",
              left: "-40px",
              top: "40px",
              WebkitAppearance: "none",
              appearance: "none",
              background: "transparent",
              direction: "ltr",
            }}
          />
        </div>

        <span className="text-[8px] text-slate-500 uppercase tracking-wider text-center leading-tight">
          {icon && <span className="block text-xs mb-0.5">{icon}</span>}
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-xs">{icon}</span>}
          <span className="text-[11px] font-medium text-slate-300">{label}</span>
        </div>
        {showValue && (
          <span className="text-[11px] font-bold tabular-nums text-white">
            {formatVal(value)}
            <span className="text-slate-500 font-normal text-[9px]">{unit}</span>
          </span>
        )}
      </div>
      <div className="relative h-1.5 rounded-full bg-slate-800/60 overflow-hidden group">
        <div
          className="h-full rounded-full transition-all duration-75 relative"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}90, ${color})`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ margin: 0, padding: 0 }}
        />
      </div>
    </div>
  );
}

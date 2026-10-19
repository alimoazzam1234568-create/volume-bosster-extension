interface Props {
  level: number;   // 0–1 (RMS)
  peak: number;    // 0–1
  isActive: boolean;
  label: string;
  height?: number;
}

export default function VUMeter({ level, peak, isActive, label, height = 100 }: Props) {
  const segments = 24;
  const activeLevel = Math.floor(level * segments);
  const peakSegment = Math.floor(peak * segments);

  const getColor = (i: number) => {
    const r = i / segments;
    if (r < 0.5) return "#22c55e";
    if (r < 0.72) return "#eab308";
    if (r < 0.88) return "#f97316";
    return "#ef4444";
  };

  const dB = level > 0.001 ? Math.round(20 * Math.log10(level)) : -Infinity;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold text-white tabular-nums">
        {dB === -Infinity ? "-∞" : `${dB} dB`}
      </span>

      <div className="flex items-end gap-[1.5px]" style={{ height: `${height}px` }}>
        {Array.from({ length: segments }).map((_, i) => {
          const segmentH = ((i + 1) / segments) * 100;
          const isLit = isActive && i < activeLevel;
          const isPeak = isActive && i === peakSegment;
          return (
            <div
              key={i}
              className="w-[5px] rounded-sm transition-all duration-75"
              style={{
                height: `${segmentH}%`,
                background: isLit
                  ? getColor(i)
                  : isPeak
                  ? `${getColor(i)}40`
                  : "rgba(255,255,255,0.04)",
                boxShadow: isLit ? `0 0 4px ${getColor(i)}50` : "none",
              }}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: isActive ? "#22c55e" : "#475569",
            boxShadow: isActive ? "0 0 6px #22c55e50" : "none",
          }}
        />
        <span className="text-[8px] text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
}

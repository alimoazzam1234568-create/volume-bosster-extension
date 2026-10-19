interface Props {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  icon?: string;
  description?: string;
}

export default function Toggle({ label, checked, onChange, icon, description }: Props) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full group"
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-sm">{icon}</span>}
        <div className="text-left">
          <span className="text-xs font-medium text-slate-300 block">{label}</span>
          {description && (
            <span className="text-[10px] text-slate-500 block mt-0.5">{description}</span>
          )}
        </div>
      </div>
      <div
        className={`relative w-10 h-5 rounded-full transition-all duration-200 ${
          checked
            ? "bg-violet-500/40 border-violet-500/60"
            : "bg-slate-700/60 border-slate-600/40"
        } border`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
            checked
              ? "left-[22px] bg-violet-400 shadow-md shadow-violet-400/40"
              : "left-0.5 bg-slate-400"
          }`}
        />
      </div>
    </button>
  );
}

export function MiniToggle({ label, checked, onChange, color = "#8b5cf6" }: { label: string; checked: boolean; onChange: (on: boolean) => void; color?: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2"
    >
      <div
        className="relative w-7 h-4 rounded-full transition-all duration-200 border"
        style={{
          background: checked ? `${color}40` : "rgba(51, 65, 85, 0.6)",
          borderColor: checked ? `${color}60` : "rgba(71, 85, 105, 0.4)",
        }}
      >
        <div
          className="absolute top-[2px] w-3 h-3 rounded-full transition-all duration-200"
          style={{
            left: checked ? "14px" : "2px",
            background: checked ? color : "#64748b",
            boxShadow: checked ? `0 0 6px ${color}50` : "none",
          }}
        />
      </div>
      <span className="text-[10px] text-slate-400 font-medium">{label}</span>
    </button>
  );
}

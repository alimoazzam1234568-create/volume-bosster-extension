import { ReactNode } from "react";

interface Props {
  title: string;
  icon: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
  compact?: boolean;
}

export default function Section({ title, icon, children, className = "", headerRight, compact = false }: Props) {
  return (
    <div
      className={`bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 ${compact ? "p-4" : "p-5"} space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <span>{icon}</span>
          <span>{title}</span>
        </h3>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

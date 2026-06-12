import { LucideIcon, TrendingUp, Info } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  color: "violet" | "indigo" | "emerald" | "amber" | "rose";
  trend?: {
    value: number;
    isPositive: boolean;
  };
  tooltip?: string;
}

const COLOR_MAP = {
  violet: {
    container: "border-violet-500/20 hover:border-violet-500/40",
    icon: "bg-violet-500/10 text-violet-400",
    value: "text-violet-100",
  },
  indigo: {
    container: "border-indigo-500/20 hover:border-indigo-500/40",
    icon: "bg-indigo-500/10 text-indigo-400",
    value: "text-indigo-100",
  },
  emerald: {
    container: "border-emerald-500/20 hover:border-emerald-500/40",
    icon: "bg-emerald-500/10 text-emerald-400",
    value: "text-emerald-100",
  },
  amber: {
    container: "border-amber-500/20 hover:border-amber-500/40",
    icon: "bg-amber-500/10 text-amber-400",
    value: "text-amber-100",
  },
  rose: {
    container: "border-rose-500/20 hover:border-rose-500/40",
    icon: "bg-rose-500/10 text-rose-400",
    value: "text-rose-100",
  },
};

export default function StatsCard({ title, value, icon: Icon, description, color, trend, tooltip }: StatsCardProps) {
  const styles = COLOR_MAP[color];

  return (
    <div
      className={`glass-card rounded-2xl p-5 border transition-all duration-300 hover:scale-[1.02] group cursor-default ${styles.container}`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${styles.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend ? (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${trend.isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
            <TrendingUp className={`w-3 h-3 ${trend.isPositive ? '' : 'rotate-180'}`} />
            {trend.value}%
          </div>
        ) : (
          <TrendingUp className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-500 transition-colors" />
        )}
      </div>
      <div className="mt-4">
        <p className={`text-3xl font-bold leading-none ${styles.value}`}>{value}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          {tooltip && (
            <span title={tooltip}>
              <Info className="w-3.5 h-3.5 text-slate-500 cursor-help" />
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'error' | 'neutral';
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  badge,
}) => {
  return (
    <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-4 transition-all duration-200 hover:border-[#2A3449] hover:shadow-lg hover:shadow-black/20 group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-[#161B27] flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
          {value}
        </span>
        {badge && (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              badge.variant === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : badge.variant === 'warning'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : badge.variant === 'error'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>

      {subtext && <p className="text-[11px] text-slate-400">{subtext}</p>}
    </div>
  );
};

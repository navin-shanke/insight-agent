import React from 'react';
import { LucideIcon, ArrowRight } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'error' | 'neutral' | 'accent';
  };
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  badge,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#131724] border border-[#222938] rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:border-indigo-500/40 hover:bg-[#161B29] group relative shadow-md shadow-black/20 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
          {label}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-[#1A2030] border border-[#262D3D] flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10 transition-colors">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 font-mono">
          {value}
        </span>
        {badge && (
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
              badge.variant === 'success'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : badge.variant === 'warning'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : badge.variant === 'error'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : badge.variant === 'accent'
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-500/15 text-slate-300 border-slate-500/30'
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
        <span className="truncate">{subtext}</span>
        {onClick && (
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all flex-shrink-0 ml-1" />
        )}
      </div>
    </div>
  );
};

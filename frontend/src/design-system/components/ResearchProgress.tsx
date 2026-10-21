import React from 'react';
import { Loader2 } from 'lucide-react';

interface ResearchProgressProps {
  percentage: number;
  step?: string | null;
  status?: string;
}

export const ResearchProgress: React.FC<ResearchProgressProps> = ({
  percentage,
  step,
  status = 'running',
}) => {
  const isTerminal = ['completed', 'failed', 'cancelled', 'partial'].includes(status.toLowerCase());

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
          {!isTerminal && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
          <span className="capitalize">{step || status}</span>
        </div>
        <span className="text-slate-400 font-mono text-[11px]">{Math.round(percentage)}%</span>
      </div>

      <div className="w-full h-1.5 bg-[#161B27] rounded-full overflow-hidden border border-[#1E2535]">
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${
            status === 'failed'
              ? 'bg-rose-500'
              : status === 'partial'
              ? 'bg-amber-500'
              : status === 'cancelled'
              ? 'bg-slate-500'
              : 'bg-gradient-to-r from-indigo-500 to-indigo-400'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
};

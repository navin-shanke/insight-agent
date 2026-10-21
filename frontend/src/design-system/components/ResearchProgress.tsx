import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface ResearchProgressProps {
  percentage?: number;
  step?: string | null;
  status?: string;
  error?: string | null;
}

const STAGES = [
  { key: 'plan', label: 'Plan', match: ['load_context', 'plan_research'] },
  { key: 'search', label: 'Search', match: ['discover_sources', 'normalize_sources'] },
  { key: 'inspect', label: 'Inspect', match: ['inspect_content'] },
  { key: 'extract', label: 'Extract', match: ['extract_claims'] },
  { key: 'verify', label: 'Verify', match: ['verify_claims', 'score_discoveries'] },
  { key: 'synthesize', label: 'Synthesize', match: ['build_report', 'report'] },
];

export const ResearchProgress: React.FC<ResearchProgressProps> = ({
  step,
  status = 'running',
  error,
}) => {
  const normStatus = (status || 'running').toLowerCase();
  const isCompleted = normStatus === 'completed' || normStatus === 'complete';
  const isFailed = normStatus === 'failed';
  const isCancelled = normStatus === 'cancelled';
  const isPartial = normStatus === 'partial';
  const isTerminal = isCompleted || isFailed || isCancelled || isPartial;

  const currentStep = (step || '').toLowerCase();

  // Find active stage index
  let activeIndex = -1;
  if (isCompleted) {
    activeIndex = STAGES.length;
  } else {
    for (let i = 0; i < STAGES.length; i++) {
      if (STAGES[i].match.some((m) => currentStep.includes(m))) {
        activeIndex = i;
        break;
      }
    }
    if (activeIndex === -1 && normStatus === 'running') {
      activeIndex = 0;
    }
  }

  const formatStepLabel = (s: string) => {
    if (!s) return 'Processing...';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="w-full space-y-2">
      {/* Step name & Status Label */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
          {!isTerminal && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
          {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          {isFailed && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
          {isPartial && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
          <span className="capitalize text-slate-200">
            {isTerminal ? `Execution ${normStatus}` : formatStepLabel(step || normStatus)}
          </span>
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          {isCompleted ? '100%' : activeIndex >= 0 ? `Stage ${activeIndex + 1} of ${STAGES.length}` : ''}
        </span>
      </div>

      {/* 6-Stage Visual Stepper */}
      <div className="grid grid-cols-6 gap-1.5 w-full">
        {STAGES.map((st, i) => {
          const isDone = isCompleted || i < activeIndex;
          const isCurrent = !isTerminal && i === activeIndex;

          let barBg = 'bg-[#161B27] border-[#1E2535]';
          let textColor = 'text-slate-500';

          if (isDone) {
            barBg = 'bg-emerald-500/20 border-emerald-500/40';
            textColor = 'text-emerald-400 font-semibold';
          } else if (isCurrent) {
            barBg = 'bg-indigo-500/30 border-indigo-500 animate-pulse';
            textColor = 'text-indigo-300 font-semibold';
          } else if (isFailed && i === activeIndex) {
            barBg = 'bg-rose-500/30 border-rose-500';
            textColor = 'text-rose-400';
          } else if (isPartial && i === activeIndex) {
            barBg = 'bg-amber-500/30 border-amber-500';
            textColor = 'text-amber-400';
          }

          return (
            <div key={st.key} className="space-y-1">
              <div className={`h-1.5 rounded-full border transition-all ${barBg}`} />
              <div className={`text-[10px] text-center truncate ${textColor}`}>
                {st.label}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-[11px] text-rose-400 font-mono bg-rose-500/10 p-2 rounded border border-rose-500/20">
          {error}
        </p>
      )}
    </div>
  );
};

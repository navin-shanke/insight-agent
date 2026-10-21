import React from 'react';

interface TaskStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const norm = status.toLowerCase();

  let styles = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  let dotColor = 'bg-slate-400';
  let pulse = false;

  if (norm === 'running' || norm === 'initializing' || norm === 'pending') {
    styles = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    dotColor = 'bg-indigo-400';
    pulse = true;
  } else if (norm === 'completed' || norm === 'complete' || norm === 'verified') {
    styles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    dotColor = 'bg-emerald-400';
  } else if (norm === 'partial') {
    styles = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    dotColor = 'bg-amber-400';
  } else if (norm === 'cancelled' || norm === 'canceled') {
    styles = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    dotColor = 'bg-slate-400';
  } else if (norm === 'failed' || norm === 'error' || norm === 'disputed') {
    styles = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    dotColor = 'bg-rose-400';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${padding} ${styles} font-mono`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="capitalize">{norm}</span>
    </span>
  );
};

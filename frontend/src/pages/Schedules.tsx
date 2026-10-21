import React, { useEffect, useState } from 'react';
import { Calendar, Clock, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { TaskStatusBadge } from '../design-system/components/TaskStatusBadge';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchSchedules } from '../api/schedules';
import { ScheduledRun } from '../types';

export const Schedules: React.FC = () => {
  const [runs, setRuns] = useState<ScheduledRun[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchSchedules({ page_size: 50 });
      setRuns(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Scheduled Runs Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Audit history of recurring discovery cycles, lease fences, next scheduled windows, and coverage.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535] transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh Runs</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : runs.length > 0 ? (
        <div className="space-y-3">
          {runs.map((run) => (
            <div
              key={run.id}
              className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-indigo-400">
                    {run.schedule_key || 'daily-discovery'}
                  </span>
                  <TaskStatusBadge status={run.status} size="sm" />
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Task ID: {run.task_id.slice(0, 16)}...
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-[#1E2535]/60">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Last Executed:</span>
                  <span className="text-slate-200 font-mono">
                    {run.last_run_at ? new Date(run.last_run_at).toLocaleString() : 'Never'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Next Scheduled:</span>
                  <span className="text-slate-200 font-mono">
                    {new Date(run.next_run_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {run.error_summary && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  {run.error_summary}
                </div>
              )}

              {run.digest_md && (
                <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535] text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {run.digest_md}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Calendar}
          title="No Scheduled Discovery Runs Yet"
          description="Runs initiated via the CLI scheduler or background task will record execution history and coverage logs here."
        />
      )}
    </div>
  );
};

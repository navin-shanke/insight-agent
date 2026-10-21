import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Compass,
  FileText,
  Radio,
  Calendar,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { MetricCard } from '../design-system/components/MetricCard';
import { TaskStatusBadge } from '../design-system/components/TaskStatusBadge';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchOverviewMetrics } from '../api/metrics';
import { fetchResearchTasks } from '../api/research';
import { fetchDiscoveries } from '../api/discoveries';
import { OverviewMetrics, ResearchTask, Discovery } from '../types';

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [activeTasks, setActiveTasks] = useState<ResearchTask[]>([]);
  const [recentDiscoveries, setRecentDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [m, t, d] = await Promise.all([
          fetchOverviewMetrics().catch(() => null),
          fetchResearchTasks().catch(() => ({ tasks: [], total: 0 })),
          fetchDiscoveries({ page_size: 4 }).catch(() => ({ items: [], total: 0 })),
        ]);

        if (mounted) {
          if (m) setMetrics(m);
          setActiveTasks(t.tasks.filter((task) => task.status === 'running'));
          setRecentDiscoveries(d.items || []);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 6000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Operational Command Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Live
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time research telemetry, persistent discoveries, and active investigations.
          </p>
        </div>

        <button
          onClick={() => navigate('/discover')}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all self-start md:self-auto"
        >
          <Compass className="w-4 h-4" />
          <span>Launch Investigation</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard rows={1} />
            <SkeletonCard rows={1} />
            <SkeletonCard rows={1} />
            <SkeletonCard rows={1} />
          </>
        ) : (
          <>
            <MetricCard
              label="Active Research"
              value={metrics?.active_tasks ?? 0}
              subtext={
                (metrics?.active_tasks ?? 0) > 0
                  ? 'Autonomous agents exploring'
                  : 'No active graph workers'
              }
              icon={Activity}
              badge={
                (metrics?.active_tasks ?? 0) > 0
                  ? { text: 'Running', variant: 'success' }
                  : { text: 'Idle', variant: 'neutral' }
              }
            />

            <MetricCard
              label="Discoveries Captured"
              value={metrics?.total_discoveries ?? 0}
              subtext="Cross-referenced findings"
              icon={Radio}
            />

            <MetricCard
              label="Reports Generated"
              value={metrics?.total_reports ?? 0}
              subtext="Source-grounded synthesis"
              icon={FileText}
            />

            <MetricCard
              label="Scheduled Runs"
              value={metrics?.scheduled_runs_total ?? 0}
              subtext={
                metrics?.scheduled_runs_last_status
                  ? `Last: ${metrics.scheduled_runs_last_status}`
                  : 'Automated discovery cycles'
              }
              icon={Calendar}
            />
          </>
        )}
      </div>

      {/* Two Column Layout: Running Research & Recent Discoveries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Running / Recent Tasks (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Active & Recent Investigations</span>
            </h2>
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>View all tasks</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {activeTasks.length > 0 ? (
            <div className="space-y-3">
              {activeTasks.map((task) => (
                <div
                  key={task.task_id}
                  onClick={() => navigate(`/tasks`)}
                  className="p-4 rounded-xl bg-[#11151E] border border-indigo-500/30 hover:border-indigo-500/50 cursor-pointer transition-all shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <span className="text-[10px] font-mono text-indigo-400 font-medium">
                        TASK-{task.task_id.slice(0, 8)}
                      </span>
                      <h3 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-1 mt-0.5">
                        {task.query}
                      </h3>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Step: {task.step || 'executing'}
                    </span>
                    <span>•</span>
                    <span>{task.checkpoint_count || 0} checkpoints persisted</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="No Investigations Currently Running"
              description="Insight Agent runs bounded, autonomous research loops with strict token and duration limits."
              action={{
                label: "Start New Research",
                onClick: () => navigate("/discover"),
              }}
            />
          )}
        </div>

        {/* Right Column: Latest Discoveries Preview (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-400" />
              <span>Latest Discoveries</span>
            </h2>
            <button
              onClick={() => navigate('/feed')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>Feed</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {recentDiscoveries.length > 0 ? (
            <div className="space-y-2.5">
              {recentDiscoveries.map((d) => (
                <div
                  key={d.id}
                  onClick={() => navigate('/feed')}
                  className="p-3.5 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-[#2A3449] cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      {d.category || 'General'}
                    </span>
                    <TaskStatusBadge status={d.verification_status} size="sm" />
                  </div>
                  <h4 className="text-xs font-medium text-slate-200 line-clamp-2 leading-snug">
                    {d.title}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#1E2535]/60">
                    <span>{d.sources?.length || 0} sources</span>
                    <span>{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#11151E] border border-dashed border-[#1E2535] text-center">
              <Radio className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-300">No discoveries recorded yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Findings will automatically populate as research tasks run.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

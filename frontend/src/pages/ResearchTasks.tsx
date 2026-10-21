import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ListTodo,
  RefreshCw,
  XCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { TaskStatusBadge } from '../design-system/components/TaskStatusBadge';
import { ResearchProgress } from '../design-system/components/ResearchProgress';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchResearchTasks, cancelResearchTask, subscribeResearchProgress } from '../api/research';
import { ResearchTask, ResearchProgressEvent } from '../types';

export const ResearchTasks: React.FC = () => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Per-task live progress events received via SSE
  const [liveProgress, setLiveProgress] = useState<Record<string, ResearchProgressEvent>>({});

  const loadTasks = async () => {
    try {
      const res = await fetchResearchTasks();
      setTasks(res.tasks || []);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen to SSE progress for any active or highlighted running task
  useEffect(() => {
    const runningTasks = tasks.filter((t) => t.status === 'running');
    const unsubscribes: (() => void)[] = [];

    runningTasks.forEach((task) => {
      const unsub = subscribeResearchProgress(task.task_id, (event) => {
        setLiveProgress((prev) => ({
          ...prev,
          [task.task_id]: event,
        }));
        if (event.status && event.status !== 'running') {
          loadTasks();
        }
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((fn) => fn());
    };
  }, [tasks]);

  const handleCancel = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Request cooperative cancellation for this research task?')) return;

    setCancellingId(taskId);
    try {
      await cancelResearchTask(taskId);
      await loadTasks();
    } catch (err) {
      alert('Failed to request cancellation');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ListTodo className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Research Tasks & Checkpoints
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Durable LangGraph execution ledger. Inspect live steps, step boundaries, and cooperative cancellation.
          </p>
        </div>

        <button
          onClick={loadTasks}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535] transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isExpanded = expandedId === task.task_id;
            const live = liveProgress[task.task_id];
            const currentStatus = live?.status || task.status;
            const currentStep = live?.step || task.step;
            const currentProgress = live?.progress_pct ?? (currentStatus === 'completed' ? 100 : 25);
            const isRunning = currentStatus === 'running';

            return (
              <div
                key={task.task_id}
                className={`bg-[#11151E] border rounded-xl transition-all duration-200 overflow-hidden ${
                  isExpanded || highlightId === task.task_id
                    ? 'border-indigo-500/40 shadow-lg shadow-black/20'
                    : 'border-[#1E2535] hover:border-[#2A3449]'
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : task.task_id)}
                  className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] font-mono text-indigo-400 font-semibold tracking-wide">
                        {task.task_id.slice(0, 13)}...
                      </span>
                      <TaskStatusBadge status={currentStatus} />
                    </div>
                    <h3 className="text-xs font-semibold text-slate-200 line-clamp-1">
                      {task.query || 'Unspecified Query'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    {isRunning && (
                      <div className="w-36 md:w-48">
                        <ResearchProgress
                          percentage={currentProgress}
                          step={currentStep}
                          status={currentStatus}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {isRunning && (
                        <button
                          disabled={cancellingId === task.task_id}
                          onClick={(e) => handleCancel(task.task_id, e)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      )}

                      <button className="text-slate-400 hover:text-slate-200 p-1">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#1E2535] bg-[#0E1118]/40 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-[#11151E] border border-[#1E2535]">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                          Task ID
                        </span>
                        <span className="font-mono text-[11px] text-slate-200 select-all">
                          {task.task_id}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#11151E] border border-[#1E2535]">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                          Checkpoints
                        </span>
                        <span className="font-mono text-slate-200">
                          {task.checkpoint_count ?? 0} persisted
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#11151E] border border-[#1E2535]">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                          Current Node
                        </span>
                        <span className="font-mono text-indigo-400">
                          {currentStep || 'idle'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#11151E] border border-[#1E2535]">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                          Timestamp
                        </span>
                        <span className="text-slate-200">
                          {task.updated_at
                            ? new Date(task.updated_at).toLocaleTimeString()
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#11151E] border border-[#1E2535] space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Full Research Objective
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {task.query}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ListTodo}
          title="No Research Tasks Recorded"
          description="Every dispatched investigation is tracked here with durable checkpoint persistence and step-by-step telemetry."
        />
      )}
    </div>
  );
};

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Search,
  Filter,
  Grid,
  List as ListIcon,
  Compass,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { TaskStatusBadge } from '../design-system/components/TaskStatusBadge';
import { ResearchProgress } from '../design-system/components/ResearchProgress';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchResearchTasks, cancelResearchTask, subscribeResearchProgress } from '../api/research';
import { ResearchTask, ResearchProgressEvent } from '../types';

export const ResearchTasks: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Filters & Controls
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'checkpoints'>('recent');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Per-task live progress events received via SSE
  const [liveProgress, setLiveProgress] = useState<Record<string, ResearchProgressEvent>>({});

  const loadTasks = async () => {
    try {
      const res = await fetchResearchTasks();
      setTasks(res.tasks || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 6000);
    return () => clearInterval(interval);
  }, []);

  // Listen to SSE progress for active running tasks
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
    } catch {
      alert('Failed to request cancellation');
    } finally {
      setCancellingId(null);
    }
  };

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const inQuery = (t.query || '').toLowerCase().includes(q);
          const inId = t.task_id.toLowerCase().includes(q);
          if (!inQuery && !inId) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'checkpoints') {
          return (b.checkpoint_count || 0) - (a.checkpoint_count || 0);
        }
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [tasks, statusFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222938]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ListTodo className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
              Research Operations Ledger
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Durable LangGraph execution ledger. Inspect live steps, checkpoint boundaries, and cooperative cancellation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => {
              setRefreshing(true);
              loadTasks();
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-[#141824] hover:bg-[#1A2030] text-slate-300 border border-[#262D3D] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/discover')}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Compass className="w-4 h-4" />
            <span>New Research</span>
          </button>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="p-4 rounded-2xl bg-[#131724] border border-[#222938] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search research objectives or task IDs..."
              className="w-full bg-[#0E1118] border border-[#262D3D] rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto text-xs">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[11px] uppercase font-mono text-slate-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#0E1118] border border-[#262D3D] rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="recent">Most Recent</option>
                <option value="checkpoints">Most Checkpoints</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#0E1118] border border-[#262D3D] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-[#1A2030] text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-[#1A2030] text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                title="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#222938] text-[11px]">
          {(['ALL', 'running', 'completed', 'partial', 'failed', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-[#0E1118] text-slate-400 hover:text-slate-200 border border-[#262D3D]'
              }`}
            >
              {st === 'ALL' ? 'All Operations' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Task List / Grid */}
      {filteredTasks.length > 0 ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
          {filteredTasks.map((task) => {
            const isExpanded = expandedId === task.task_id;
            const live = liveProgress[task.task_id];
            const currentStatus = live?.status || task.status;
            const currentStep = live?.step || task.step;
            const currentProgress = live?.progress_pct ?? (currentStatus === 'completed' ? 100 : 25);
            const isRunning = currentStatus === 'running';

            return (
              <div
                key={task.task_id}
                className={`bg-[#131724] border rounded-2xl transition-all duration-200 overflow-hidden shadow-md ${
                  isExpanded || highlightId === task.task_id
                    ? 'border-indigo-500/50 ring-1 ring-indigo-500/20'
                    : 'border-[#222938] hover:border-[#2C354A]'
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : task.task_id)}
                  className="p-4 sm:p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[11px] font-mono text-indigo-400 font-semibold tracking-wide">
                        TASK-{task.task_id.slice(0, 8)}
                      </span>
                      <TaskStatusBadge status={currentStatus} />
                      <span className="text-[10px] text-slate-400 font-mono">
                        {task.created_at ? new Date(task.created_at).toLocaleTimeString() : 'Pending'}
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-100 line-clamp-1">
                      {task.query || 'Unspecified Query'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs flex-shrink-0">
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
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      )}

                      <button className="text-slate-400 hover:text-slate-200 p-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-[#222938] bg-[#0E1118]/60 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[#131724] border border-[#222938]">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                          Task ID
                        </span>
                        <span className="font-mono text-[11px] text-slate-200 select-all">
                          {task.task_id}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[#131724] border border-[#222938]">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                          Checkpoints
                        </span>
                        <span className="font-mono text-slate-200 font-semibold">
                          {task.checkpoint_count ?? 0} persisted
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[#131724] border border-[#222938]">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                          Current Node
                        </span>
                        <span className="font-mono text-indigo-400 font-semibold">
                          {currentStep || 'idle'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[#131724] border border-[#222938]">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                          Last Updated
                        </span>
                        <span className="text-slate-200 font-mono">
                          {task.updated_at ? new Date(task.updated_at).toLocaleTimeString() : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#131724] border border-[#222938] space-y-2">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Full Research Objective
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">
                        {task.query}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#222938]">
                        <button
                          onClick={() => navigate('/reports')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Reports Archive</span>
                        </button>
                        <button
                          onClick={() => navigate('/feed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181D2A] hover:bg-[#202738] text-slate-300 border border-[#262D3D] text-xs font-medium transition-colors"
                        >
                          <Radio className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Inspect Discoveries</span>
                        </button>
                      </div>
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
          title="No Matching Operations Found"
          description="Adjust your search query or status filter to inspect recorded research runs."
          action={{
            label: 'Launch New Investigation',
            onClick: () => navigate('/discover'),
          }}
        />
      )}
    </div>
  );
};

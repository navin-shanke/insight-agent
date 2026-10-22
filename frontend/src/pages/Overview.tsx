import React, { useEffect, useState, useMemo } from 'react';
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
  AlertCircle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Search,
  Instagram,
  Zap,
  TrendingUp,
  Layers,
  History,
  Filter,
  Brain,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { MetricCard } from '../design-system/components/MetricCard';
import { TaskStatusBadge } from '../design-system/components/TaskStatusBadge';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchOverviewMetrics } from '../api/metrics';
import { fetchResearchTasks } from '../api/research';
import { fetchDiscoveries } from '../api/discoveries';
import { fetchReports } from '../api/reports';
import { fetchInstagramRecommendations, fetchInstagramStrategy } from '../api/instagram';
import { fetchIntegrationsStatus } from '../api/integrations';
import {
  OverviewMetrics,
  ResearchTask,
  Discovery,
  Report,
  InstagramRecommendation,
  InstagramStrategyProfile,
  IntegrationService,
} from '../types';

const STATUS_COLORS: Record<string, string> = {
  running: '#6366F1',
  completed: '#10B981',
  partial: '#F59E0B',
  failed: '#F43F5E',
  cancelled: '#64748B',
};

const VERIFICATION_COLORS: Record<string, string> = {
  Supported: '#10B981',
  'Partially Supported': '#F59E0B',
  'Contradicted / Mixed': '#F43F5E',
  Unverified: '#64748B',
};

const CATEGORY_PALETTE = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export const Overview: React.FC = () => {
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [topRecommendation, setTopRecommendation] = useState<InstagramRecommendation | null>(null);
  const [strategyProfile, setStrategyProfile] = useState<InstagramStrategyProfile | null>(null);
  const [services, setServices] = useState<IntegrationService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Time-range filter for activity chart: '7D' | '30D' | 'ALL'
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | 'ALL'>('ALL');

  const loadData = async () => {
    try {
      const [m, t, d, r, recs, strat, integ] = await Promise.all([
        fetchOverviewMetrics().catch(() => null),
        fetchResearchTasks().catch(() => ({ tasks: [], total: 0 })),
        fetchDiscoveries({ page_size: 50 }).catch(() => ({ items: [], total: 0 })),
        fetchReports({ page_size: 10 }).catch(() => ({ items: [], total: 0 })),
        fetchInstagramRecommendations().catch(() => []),
        fetchInstagramStrategy().catch(() => null),
        fetchIntegrationsStatus().catch(() => ({ services: [] })),
      ]);

      if (m) setMetrics(m);
      setTasks(t.tasks || []);
      setDiscoveries(d.items || []);
      setReports(r.items || []);
      if (recs && recs.length > 0) {
        setTopRecommendation(recs[0]);
      }
      if (strat) setStrategyProfile(strat);
      if (integ && integ.services) setServices(integ.services);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Real task status distribution for Donut Chart
  const taskStatusChartData = useMemo(() => {
    const map: Record<string, number> = {
      running: 0,
      completed: 0,
      partial: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const t of tasks) {
      const st = t.status || 'running';
      map[st] = (map[st] || 0) + 1;
    }
    return Object.entries(map)
      .map(([status, value]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        status,
        value,
        color: STATUS_COLORS[status] || '#64748B',
      }))
      .filter((item) => item.value > 0);
  }, [tasks]);

  // Real time-series activity chart data
  const activityChartData = useMemo(() => {
    const dateMap: Record<string, { date: string; tasks: number; discoveries: number; reports: number }> = {};

    // Group tasks by date
    for (const t of tasks) {
      if (t.created_at) {
        const d = new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (!dateMap[d]) dateMap[d] = { date: d, tasks: 0, discoveries: 0, reports: 0 };
        dateMap[d].tasks += 1;
      }
    }

    // Group discoveries by date
    for (const d of discoveries) {
      if (d.created_at) {
        const dateStr = new Date(d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (!dateMap[dateStr]) dateMap[dateStr] = { date: dateStr, tasks: 0, discoveries: 0, reports: 0 };
        dateMap[dateStr].discoveries += 1;
      }
    }

    // Group reports by date
    for (const r of reports) {
      if (r.created_at) {
        const dateStr = new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (!dateMap[dateStr]) dateMap[dateStr] = { date: dateStr, tasks: 0, discoveries: 0, reports: 0 };
        dateMap[dateStr].reports += 1;
      }
    }

    const data = Object.values(dateMap);
    if (data.length === 0) {
      // Fallback point with real timestamp if completely clean
      return [{ date: 'Today', tasks: tasks.length, discoveries: discoveries.length, reports: reports.length }];
    }
    return data;
  }, [tasks, discoveries, reports]);

  // Real Category Distribution for Bar Chart
  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of discoveries) {
      const cat = d.category || 'General';
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [discoveries]);

  // Real Verification Stance Ratio
  const verificationChartData = useMemo(() => {
    let supported = 0;
    let partial = 0;
    let contradicted = 0;
    let unverified = 0;

    for (const rep of reports) {
      if (rep.metrics) {
        supported += rep.metrics.supported_count;
        partial += rep.metrics.partially_supported_count;
        contradicted += rep.metrics.contradicted_count;
        unverified += rep.metrics.unverified_count;
      }
    }

    if (supported + partial + contradicted + unverified === 0) {
      for (const d of discoveries) {
        const st = (d.verification_status || '').toUpperCase();
        if (st === 'VERIFIED' || st === 'SUPPORTED') supported++;
        else if (st === 'DISPUTED' || st === 'CONTRADICTED') contradicted++;
        else unverified++;
      }
    }

    return [
      { name: 'Supported', value: supported, color: VERIFICATION_COLORS['Supported'] },
      { name: 'Partially Supported', value: partial, color: VERIFICATION_COLORS['Partially Supported'] },
      { name: 'Contradicted / Mixed', value: contradicted, color: VERIFICATION_COLORS['Contradicted / Mixed'] },
      { name: 'Unverified', value: unverified, color: VERIFICATION_COLORS['Unverified'] },
    ].filter((item) => item.value > 0);
  }, [reports, discoveries]);

  // Chronological Activity Timeline from real events
  const timelineEvents = useMemo(() => {
    const events: Array<{ id: string; title: string; time: string; type: 'task' | 'report' | 'discovery'; detail: string }> = [];

    tasks.slice(0, 3).forEach((t) => {
      events.push({
        id: `task-${t.task_id}`,
        title: `Investigation: ${t.query.slice(0, 50)}...`,
        time: t.updated_at ? new Date(t.updated_at).toLocaleTimeString() : 'Recent',
        type: 'task',
        detail: `Status: ${t.status} • ${t.checkpoint_count || 0} checkpoints`,
      });
    });

    reports.slice(0, 2).forEach((r) => {
      events.push({
        id: `rep-${r.id}`,
        title: `Dossier Synthesized: ${r.title.slice(0, 50)}`,
        time: new Date(r.created_at).toLocaleTimeString(),
        type: 'report',
        detail: `${r.discovery_ids?.length || 0} linked discoveries`,
      });
    });

    discoveries.slice(0, 2).forEach((d) => {
      events.push({
        id: `disc-${d.id}`,
        title: `Evidence Verified: ${d.title.slice(0, 50)}`,
        time: new Date(d.created_at).toLocaleTimeString(),
        type: 'discovery',
        detail: `Category: ${d.category || 'General'}`,
      });
    });

    return events.slice(0, 5);
  }, [tasks, reports, discoveries]);

  const activeTasks = tasks.filter((t) => t.status === 'running');
  const recentTasks = tasks.slice(0, 4);

  const ollamaService = services.find((s) => s.name.toLowerCase().includes('ollama'));
  const ddgService = services.find((s) => s.name.toLowerCase().includes('duckduckgo'));

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Page Header Introduction */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#222938]">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
              Intelligence Overview
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Real-time research telemetry, persistent multi-source discoveries, and adaptive intelligence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-[#141824] hover:bg-[#1A2030] text-slate-300 border border-[#262D3D] transition-colors disabled:opacity-50"
            title="Refresh telemetry metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => navigate('/instagram')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/35 transition-all shadow-sm"
          >
            <Instagram className="w-3.5 h-3.5 text-pink-400" />
            <span>Instagram Studio</span>
          </button>

          <button
            onClick={() => navigate('/discover')}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98]"
          >
            <Compass className="w-4 h-4" />
            <span>New Research</span>
          </button>
        </div>
      </div>

      {/* Visual KPI Strip (4 High-Impact Modules) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
          </>
        ) : (
          <>
            <MetricCard
              label="Active Investigations"
              value={metrics?.active_tasks ?? 0}
              subtext={`${metrics?.total_tasks ?? 0} total investigations recorded`}
              icon={Activity}
              badge={
                (metrics?.active_tasks ?? 0) > 0
                  ? { text: 'Running', variant: 'accent' }
                  : { text: 'Idle', variant: 'neutral' }
              }
              onClick={() => navigate('/tasks')}
            />

            <MetricCard
              label="Verified Discoveries"
              value={metrics?.total_discoveries ?? 0}
              subtext="Cross-referenced evidence findings"
              icon={Radio}
              badge={{ text: 'Grounded', variant: 'success' }}
              onClick={() => navigate('/feed')}
            />

            <MetricCard
              label="Intelligence Dossiers"
              value={metrics?.total_reports ?? 0}
              subtext="Source-cited synthesized reports"
              icon={FileText}
              badge={{ text: 'Cited', variant: 'accent' }}
              onClick={() => navigate('/reports')}
            />

            <MetricCard
              label="Adaptive Learning Profile"
              value={`v${strategyProfile?.version ?? 1}`}
              subtext={`Calibrated across N=${strategyProfile?.sample_size ?? 0} posts`}
              icon={Brain}
              badge={{ text: `${strategyProfile?.tested_hypotheses?.length || 0} Hypotheses`, variant: 'accent' }}
              onClick={() => navigate('/instagram')}
            />
          </>
        )}
      </div>

      {/* Prioritized Recommendation Spotlight Banner */}
      {topRecommendation && (
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-[#131724] to-[#131724] border border-indigo-500/35 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Strategic Insight Recommendation
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                topRecommendation.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {topRecommendation.priority} Priority
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100">{topRecommendation.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
              {topRecommendation.what_to_do}
            </p>
          </div>
          <button
            onClick={() => navigate('/instagram')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30 self-start md:self-auto flex-shrink-0"
          >
            <span>Action in Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Research Activity & Output Velocity Chart */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#131724] border border-[#222938] space-y-4 shadow-lg shadow-black/25">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span>Research Velocity & Output Trends</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical timeline of autonomous investigations, discovered claims, and completed dossiers.
            </p>
          </div>

          <div className="flex items-center gap-1 text-xs">
            {(['7D', '30D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 rounded-lg font-mono font-medium text-[11px] transition-colors ${
                  timeRange === r
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#181D2A] text-slate-400 hover:text-slate-200 border border-[#262D3D]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorDiscoveries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} tickLine={false} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#0E1118', borderColor: '#262D3D', borderRadius: '10px', fontSize: '12px' }}
                itemStyle={{ color: '#E2E8F0' }}
              />
              <Area type="monotone" dataKey="tasks" name="Investigations" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorTasks)" />
              <Area type="monotone" dataKey="discoveries" name="Discoveries" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorDiscoveries)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Visual Analytics Grid: Status Distribution & Topic Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Research Execution Status Donut */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#131724] border border-[#222938] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>Execution Status Distribution</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Real breakdown of investigations across lifecycle states</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{tasks.length} total tasks</span>
          </div>

          {taskStatusChartData.length > 0 ? (
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {taskStatusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0E1118', borderColor: '#262D3D', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#E2E8F0' }}
                  />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#222938] rounded-xl">
              <Activity className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">No execution data recorded yet</p>
            </div>
          )}
        </div>

        {/* Chart 2: Discovery Focus by Category */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#131724] border border-[#222938] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                <span>Discovery Intelligence Focus</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Top verified subject categories extracted from sources</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{discoveries.length} findings</span>
          </div>

          {categoryChartData.length > 0 ? (
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <XAxis type="number" stroke="#64748B" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={11} width={90} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0E1118', borderColor: '#262D3D', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#E2E8F0' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {categoryChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#222938] rounded-xl">
              <Radio className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">No category data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Investigations Ledger & Recent Discoveries Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Active & Recent Investigations */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-400" />
              <span>Research Operations Ledger</span>
            </h2>
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>View all operations</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {activeTasks.length > 0 && (
            <div className="space-y-3">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-semibold">
                In-Flight Investigations ({activeTasks.length})
              </span>
              {activeTasks.map((task) => (
                <div
                  key={task.task_id}
                  onClick={() => navigate(`/tasks`)}
                  className="p-4 rounded-xl bg-[#141824] border border-indigo-500/40 hover:border-indigo-500/70 cursor-pointer transition-all shadow-md group"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <span className="text-[10px] font-mono text-indigo-400 font-semibold">
                        TASK-{task.task_id.slice(0, 8)}
                      </span>
                      <h3 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-1 mt-0.5">
                        {task.query}
                      </h3>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Step: {task.step || 'executing'}
                    </span>
                    <span>•</span>
                    <span>{task.checkpoint_count || 0} checkpoints persisted</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentTasks.length > 0 ? (
            <div className="space-y-2.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-semibold pt-1">
                Recent Completed Runs
              </span>
              {recentTasks.map((task) => (
                <div
                  key={task.task_id}
                  onClick={() => navigate('/tasks')}
                  className="p-3.5 rounded-xl bg-[#131724] border border-[#222938] hover:border-[#2E374D] cursor-pointer transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 font-medium">
                        TASK-{task.task_id.slice(0, 8)}
                      </span>
                      <TaskStatusBadge status={task.status} size="sm" />
                    </div>
                    <h4 className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                      {task.query}
                    </h4>
                  </div>
                  <div className="text-right flex-shrink-0 text-[11px] text-slate-400 font-mono">
                    {task.checkpoint_count || 0} chkpts
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="No Research History Recorded"
              description="Insight Agent runs bounded, autonomous research loops with strict token and duration limits."
              action={{
                label: 'Start New Investigation',
                onClick: () => navigate('/discover'),
              }}
            />
          )}
        </div>

        {/* Right Column (1 col): Recent Discoveries & Activity Stream */}
        <div className="space-y-6">
          {/* Latest Discoveries Feed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                <span>Discovery Feed</span>
              </h2>
              <button
                onClick={() => navigate('/feed')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
              >
                <span>Feed</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {discoveries.length > 0 ? (
              <div className="space-y-2.5">
                {discoveries.slice(0, 3).map((d) => (
                  <div
                    key={d.id}
                    onClick={() => navigate('/feed')}
                    className="p-3.5 rounded-xl bg-[#131724] border border-[#222938] hover:border-indigo-500/40 cursor-pointer transition-all space-y-2 group shadow-sm"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="text-indigo-400 font-semibold uppercase">{d.category || 'General'}</span>
                      <TaskStatusBadge status={d.verification_status} size="sm" />
                    </div>
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
                      {d.title}
                    </h4>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#222938]">
                      <span>{d.sources?.length || 0} sources</span>
                      <span>{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-xl bg-[#131724] border border-dashed border-[#222938] text-xs text-slate-400">
                No discoveries captured yet.
              </div>
            )}
          </div>

          {/* Activity Event Stream */}
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span>Activity Stream</span>
            </h2>

            <div className="divide-y divide-[#222938] rounded-xl border border-[#222938] bg-[#131724] overflow-hidden text-xs">
              {timelineEvents.map((ev) => (
                <div key={ev.id} className="p-3 flex items-start justify-between gap-3 hover:bg-[#161B29] transition-colors">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium text-slate-200 truncate">{ev.title}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{ev.detail}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                    {ev.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
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

const VERIFICATION_COLORS: Record<string, string> = {
  Supported: '#10B981',
  'Partially Supported': '#F59E0B',
  'Contradicted / Mixed': '#F43F5E',
  Unverified: '#64748B',
};

const CATEGORY_PALETTE = ['#6366F1', '#8B5CF6', '#EC4899', '#3B82F6', '#14B8A6', '#F59E0B'];

export const Overview: React.FC = () => {
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [recentDiscoveries, setRecentDiscoveries] = useState<Discovery[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [topRecommendation, setTopRecommendation] = useState<InstagramRecommendation | null>(null);
  const [strategyProfile, setStrategyProfile] = useState<InstagramStrategyProfile | null>(null);
  const [services, setServices] = useState<IntegrationService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [m, t, d, r, recs, strat, integ] = await Promise.all([
        fetchOverviewMetrics().catch(() => null),
        fetchResearchTasks().catch(() => ({ tasks: [], total: 0 })),
        fetchDiscoveries({ page_size: 50 }).catch(() => ({ items: [], total: 0 })),
        fetchReports({ page_size: 5 }).catch(() => ({ items: [], total: 0 })),
        fetchInstagramRecommendations().catch(() => []),
        fetchInstagramStrategy().catch(() => null),
        fetchIntegrationsStatus().catch(() => ({ services: [] })),
      ]);

      if (m) setMetrics(m);
      setTasks(t.tasks || []);
      setRecentDiscoveries(d.items || []);
      setRecentReports(r.items || []);
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

  // Compute category distribution for charts from real discoveries
  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of recentDiscoveries) {
      const cat = d.category || 'General';
      map[cat] = (map[cat] || 0) + 1;
    }
    const entries = Object.entries(map).map(([name, count]) => ({ name, count }));
    return entries.sort((a, b) => b.count - a.count).slice(0, 6);
  }, [recentDiscoveries]);

  // Compute verification distribution from real reports and discoveries
  const verificationChartData = useMemo(() => {
    let supported = 0;
    let partial = 0;
    let contradicted = 0;
    let unverified = 0;

    for (const rep of recentReports) {
      if (rep.metrics) {
        supported += rep.metrics.supported_count;
        partial += rep.metrics.partially_supported_count;
        contradicted += rep.metrics.contradicted_count;
        unverified += rep.metrics.unverified_count;
      }
    }

    if (supported + partial + contradicted + unverified === 0) {
      for (const d of recentDiscoveries) {
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
  }, [recentReports, recentDiscoveries]);

  const activeTasks = tasks.filter((t) => t.status === 'running');
  const finishedTasks = tasks.filter((t) => t.status !== 'running').slice(0, 4);

  const ollamaService = services.find((s) => s.name.toLowerCase().includes('ollama'));
  const ddgService = services.find((s) => s.name.toLowerCase().includes('duckduckgo'));

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Command Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
              <span>Intelligence Command Center</span>
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Engine Online
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time research telemetry, persistent multi-source discoveries, and adaptive intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535] transition-colors disabled:opacity-50"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => navigate('/instagram')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/30 transition-all"
          >
            <Instagram className="w-3.5 h-3.5 text-pink-400" />
            <span>Instagram Studio</span>
          </button>

          <button
            onClick={() => navigate('/discover')}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Compass className="w-4 h-4" />
            <span>Launch Investigation</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ribbon (5 interactive columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {loading ? (
          <>
            <SkeletonCard rows={1} />
            <SkeletonCard rows={1} />
            <SkeletonCard rows={1} />
            <SkeletonCard rows={1} />
            <SkeletonCard rows={1} />
          </>
        ) : (
          <>
            <div
              onClick={() => navigate('/tasks')}
              className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-indigo-500/50 cursor-pointer transition-all hover:bg-[#161B27]/40 group"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium group-hover:text-indigo-400 transition-colors">Active Research</span>
                <Activity className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-100">{metrics?.active_tasks ?? 0}</span>
                <span className="text-[11px] text-slate-500 font-mono">/ {metrics?.total_tasks ?? 0} total</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>{metrics?.active_tasks ? 'Agents running' : 'System idle'}</span>
                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>

            <div
              onClick={() => navigate('/feed')}
              className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-indigo-500/50 cursor-pointer transition-all hover:bg-[#161B27]/40 group"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium group-hover:text-indigo-400 transition-colors">Discoveries</span>
                <Radio className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">{metrics?.total_discoveries ?? 0}</div>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Cross-verified findings</span>
                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>

            <div
              onClick={() => navigate('/reports')}
              className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-indigo-500/50 cursor-pointer transition-all hover:bg-[#161B27]/40 group"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium group-hover:text-indigo-400 transition-colors">Reports Dossiers</span>
                <FileText className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">{metrics?.total_reports ?? 0}</div>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Source-cited synthesis</span>
                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>

            <div
              onClick={() => navigate('/instagram')}
              className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-pink-500/50 cursor-pointer transition-all hover:bg-[#161B27]/40 group"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium group-hover:text-pink-400 transition-colors">Adaptive Strategy</span>
                <Instagram className="w-4 h-4 text-pink-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-pink-300">v{strategyProfile?.version ?? 1}</span>
                <span className="text-[11px] text-slate-500 font-mono">N={strategyProfile?.sample_size ?? 0}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>{strategyProfile?.tested_hypotheses?.length || 0} tested hypotheses</span>
                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-medium">Engine Telemetry</span>
                <Cpu className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-1.5 py-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Ollama Local LLM</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${ollamaService?.status === 'connected' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {ollamaService?.status === 'connected' ? 'Connected' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">DuckDuckGo Search</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${ddgService?.status === 'connected' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {ddgService?.status === 'connected' ? 'Ready' : 'Checking'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">SQLite Local DB (Safe)</span>
            </div>
          </>
        )}
      </div>

      {/* Prioritized Recommendation Spotlight Banner */}
      {topRecommendation && (
        <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-[#11151E] to-[#11151E] border border-indigo-500/30 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Prioritized Instagram Recommendation
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                topRecommendation.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {topRecommendation.priority} Priority
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100">{topRecommendation.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
              {topRecommendation.what_to_do}
            </p>
          </div>
          <button
            onClick={() => navigate('/instagram')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors self-start md:self-auto flex-shrink-0"
          >
            <span>Review & Experiment</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Interactive Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Research Categorization Breakdown */}
        <div className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                <span>Discovery Intelligence Focus</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Distribution of verified findings across topic categories</p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">{recentDiscoveries.length} total findings</span>
          </div>

          {categoryChartData.length > 0 ? (
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <XAxis type="number" stroke="#64748B" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={11} width={100} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0E1118', borderColor: '#1E2535', borderRadius: '8px', fontSize: '12px' }}
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
            <div className="h-56 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#1E2535] rounded-lg">
              <Radio className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">No category data available</p>
              <p className="text-[11px] text-slate-500 mt-1">Run an investigation to generate verified topic data.</p>
            </div>
          )}
        </div>

        {/* Chart 2: Evidence Integrity & Stance Distribution */}
        <div className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Evidence Verification Integrity</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Real factual claim verification stances across reports</p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Grounded Claims</span>
          </div>

          {verificationChartData.length > 0 ? (
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={verificationChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {verificationChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0E1118', borderColor: '#1E2535', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#E2E8F0' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#1E2535] rounded-lg">
              <ShieldCheck className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">No verification data recorded yet</p>
              <p className="text-[11px] text-slate-500 mt-1">Generated report claims will establish evidence integrity metrics.</p>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Research Activity & Recent Intelligence Dossiers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Research Jobs & Running Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Research Investigations & Execution</span>
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
              <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider block">
                Active In-Flight ({activeTasks.length})
              </span>
              {activeTasks.map((task) => (
                <div
                  key={task.task_id}
                  onClick={() => navigate(`/tasks`)}
                  className="p-4 rounded-xl bg-[#11151E] border border-indigo-500/40 hover:border-indigo-500/70 cursor-pointer transition-all shadow-md group"
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
          ) : null}

          {finishedTasks.length > 0 ? (
            <div className="space-y-2.5">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block pt-1">
                Recent Completed Runs
              </span>
              {finishedTasks.map((task) => (
                <div
                  key={task.task_id}
                  onClick={() => navigate('/tasks')}
                  className="p-3.5 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-[#2A3449] cursor-pointer transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">
                        TASK-{task.task_id.slice(0, 8)}
                      </span>
                      <TaskStatusBadge status={task.status} size="sm" />
                    </div>
                    <h4 className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                      {task.query}
                    </h4>
                  </div>
                  <div className="text-right flex-shrink-0 text-[11px] text-slate-500 font-mono">
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

        {/* Right Column (1 col): Recent Synthesized Dossiers & Reports */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Intelligence Dossiers</span>
            </h2>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>Archive</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {recentReports.length > 0 ? (
            <div className="space-y-3">
              {recentReports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => navigate(`/reports/${report.id}`)}
                  className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-indigo-500/40 cursor-pointer transition-all space-y-2 group shadow-sm"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>{new Date(report.created_at).toLocaleDateString()}</span>
                    <span className="px-1.5 py-0.2 rounded bg-[#161B27] text-indigo-300 border border-[#1E2535]">
                      {report.discovery_ids?.length || 0} Discoveries
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
                    {report.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 font-mono">
                    {report.query}
                  </p>
                  <div className="pt-2 border-t border-[#1E2535] flex items-center justify-between text-[11px] text-indigo-400 font-medium">
                    <span>Explore interactive dossier</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#11151E] border border-dashed border-[#1E2535] text-center">
              <FileText className="w-6 h-6 text-slate-500 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-300">No synthesized reports yet</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Completed investigations automatically compile into cited dossiers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

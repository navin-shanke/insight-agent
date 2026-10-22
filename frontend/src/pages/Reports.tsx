import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ArrowRight,
  Calendar,
  Search,
  ExternalLink,
  ShieldCheck,
  Globe,
  Layers,
  Filter,
  LayoutGrid,
  List,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchReports } from '../api/reports';
import { Report } from '../types';

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'claims' | 'sources'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchReports({ q: searchTerm.trim() || undefined });
      setReports(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered and sorted reports
  const displayedReports = useMemo(() => {
    let result = [...reports];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.title?.toLowerCase().includes(term) ||
          r.query?.toLowerCase().includes(term) ||
          r.summary?.toLowerCase().includes(term)
      );
    }

    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'claims') {
      result.sort((a, b) => (b.metrics?.total_claims_count || 0) - (a.metrics?.total_claims_count || 0));
    } else if (sortBy === 'sources') {
      result.sort((a, b) => (b.metrics?.unique_sources_count || 0) - (a.metrics?.unique_sources_count || 0));
    }

    return result;
  }, [reports, searchTerm, sortBy]);

  // High-level aggregates
  const stats = useMemo(() => {
    const totalReports = reports.length;
    let totalClaims = 0;
    let totalSources = 0;
    let totalSupported = 0;

    reports.forEach((r) => {
      if (r.metrics) {
        totalClaims += r.metrics.total_claims_count || 0;
        totalSources += r.metrics.unique_sources_count || 0;
        totalSupported += r.metrics.supported_count || 0;
      }
    });

    return { totalReports, totalClaims, totalSources, totalSupported };
  }, [reports]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Intelligence Dossiers & Reports
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Multi-source synthetic dossiers with claim-level verification and provenance graphs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/discover')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Research</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Published Reports</div>
            <div className="text-lg font-bold font-mono text-slate-100">{stats.totalReports}</div>
          </div>
        </div>

        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Claims Verified</div>
            <div className="text-lg font-bold font-mono text-slate-100">{stats.totalClaims}</div>
          </div>
        </div>

        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Distinct Sources</div>
            <div className="text-lg font-bold font-mono text-slate-100">{stats.totalSources}</div>
          </div>
        </div>

        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Supported Findings</div>
            <div className="text-lg font-bold font-mono text-slate-100">{stats.totalSupported}</div>
          </div>
        </div>
      </div>

      {/* Toolbar / Search / Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11151E] border border-[#1E2535] rounded-xl p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadData();
          }}
          className="relative flex-1"
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search reports by title, topic, or query..."
            className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50"
          />
        </form>

        <div className="flex items-center gap-2">
          {/* Sort selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#0E1118] border border-[#1E2535] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="claims">Sort: Most Claims</option>
              <option value="sources">Sort: Most Sources</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-[#0E1118] border border-[#1E2535] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${
                viewMode === 'grid'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${
                viewMode === 'table'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : displayedReports.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedReports.map((report) => {
              const m = report.metrics;
              const hasMetrics = Boolean(m && m.total_claims_count > 0);

              return (
                <div
                  key={report.id}
                  onClick={() => navigate(`/reports/${report.id}`)}
                  className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-black/30 cursor-pointer transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    {/* Top Row: Date & Discoveries count */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                      </span>
                      <span className="text-indigo-400 font-semibold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                        {report.discovery_ids?.length || 0} discoveries
                      </span>
                    </div>

                    {/* Report Title */}
                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
                      {report.title}
                    </h3>

                    {/* Report Summary / Executive excerpt */}
                    {(report.executive_summary || report.summary) && (
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {report.executive_summary || report.summary}
                      </p>
                    )}

                    {/* Verification Breakdown Pill bar */}
                    {hasMetrics && m && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
                          <span>Verification Stance</span>
                          <span>{m.total_claims_count} Claims</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#161B27] rounded-full overflow-hidden flex gap-0.5">
                          {m.supported_count > 0 && (
                            <div
                              style={{ width: `${(m.supported_count / m.total_claims_count) * 100}%` }}
                              className="bg-emerald-500 h-full"
                              title={`Supported: ${m.supported_count}`}
                            />
                          )}
                          {m.partially_supported_count > 0 && (
                            <div
                              style={{ width: `${(m.partially_supported_count / m.total_claims_count) * 100}%` }}
                              className="bg-amber-500 h-full"
                              title={`Partially Supported: ${m.partially_supported_count}`}
                            />
                          )}
                          {m.contradicted_count > 0 && (
                            <div
                              style={{ width: `${(m.contradicted_count / m.total_claims_count) * 100}%` }}
                              className="bg-rose-500 h-full"
                              title={`Contradicted: ${m.contradicted_count}`}
                            />
                          )}
                          {m.unverified_count > 0 && (
                            <div
                              style={{ width: `${(m.unverified_count / m.total_claims_count) * 100}%` }}
                              className="bg-slate-500 h-full"
                              title={`Unverified: ${m.unverified_count}`}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Stats & Read Button */}
                  <div className="pt-3 border-t border-[#1E2535] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                      {m?.unique_sources_count ? (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          <span>{m.unique_sources_count} sources</span>
                        </span>
                      ) : null}
                      {m?.unique_domains_count ? (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span>{m.unique_domains_count} domains</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1 font-medium text-indigo-400 group-hover:text-indigo-300 transition-colors">
                      <span>Inspect Dossier</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-[#11151E] border border-[#1E2535] rounded-xl overflow-hidden shadow-lg shadow-black/20">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2535] bg-[#0E1118]/80 text-[11px] font-mono uppercase text-slate-400">
                    <th className="py-3 px-4 font-semibold">Report Dossier</th>
                    <th className="py-3 px-4 font-semibold">Claims & Evidence</th>
                    <th className="py-3 px-4 font-semibold">Sources</th>
                    <th className="py-3 px-4 font-semibold">Created</th>
                    <th className="py-3 px-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2535]/60 text-slate-300">
                  {displayedReports.map((report) => (
                    <tr
                      key={report.id}
                      onClick={() => navigate(`/reports/${report.id}`)}
                      className="hover:bg-[#161B27]/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                          {report.title}
                        </div>
                        {report.query && (
                          <div className="text-[11px] text-slate-400 line-clamp-1 font-mono">
                            {report.query}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="text-slate-200">
                          {report.metrics?.total_claims_count || report.findings?.length || 0} claims
                        </span>
                        {report.metrics && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                            <span className="text-emerald-400">✓ {report.metrics.supported_count}</span>
                            <span className="text-amber-400">~ {report.metrics.partially_supported_count}</span>
                            <span className="text-rose-400">✗ {report.metrics.contradicted_count}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {report.metrics?.unique_sources_count || report.sources?.length || 0} sources
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {new Date(report.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-indigo-400 group-hover:text-indigo-300 font-medium">
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <EmptyState
          icon={FileText}
          title="No Reports Generated Yet"
          description="Autonomous research synthesis runs automatically whenever an investigation completes."
          action={{
            label: 'Start Research Task',
            onClick: () => navigate('/discover'),
          }}
        />
      )}
    </div>
  );
};

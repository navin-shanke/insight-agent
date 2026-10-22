import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  FileText,
  AlertTriangle,
  ExternalLink,
  Globe,
  Layers,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Copy,
  Download,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Scale,
  Search,
  Network,
  BarChart2,
  Filter,
  X,
  Share2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { fetchReport } from '../api/reports';
import { Report, ReportFinding, ReportSource } from '../types';

function cleanMarkdownText(text: string): string {
  if (!text) return '';
  let cleaned = text.replace(/\\([#*\[\]_`])/g, '$1');
  cleaned = cleaned.replace(/^\s*svg\s*$/gim, '');
  cleaned = cleaned.replace(/ClaimVerdict\./g, '');
  return cleaned;
}

const VERIFICATION_COLORS: Record<string, string> = {
  SUPPORTED: '#10B981',
  PARTIALLY_SUPPORTED: '#F59E0B',
  CONTRADICTED: '#F43F5E',
  UNVERIFIED: '#64748B',
};

export const ReportDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'summary' | 'matrix' | 'sources' | 'dossier'
  const [activeTab, setActiveTab] = useState<'summary' | 'matrix' | 'sources' | 'dossier'>('summary');

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Finding expansion & inspection
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [selectedFinding, setSelectedFinding] = useState<ReportFinding | null>(null);

  // Copy feedback state
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchReport(id)
      .then((data) => {
        setReport(data);
        if (data.findings && data.findings.length > 0) {
          // Pre-select first finding for inspection
          setSelectedFinding(data.findings[0]);
        }
      })
      .catch(() => setError('Report not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const cleanBody = useMemo(() => {
    return cleanMarkdownText(report?.body_md || report?.summary || '');
  }, [report?.body_md, report?.summary]);

  const toggleFinding = (fId: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(fId)) {
        next.delete(fId);
      } else {
        next.add(fId);
      }
      return next;
    });
  };

  const expandAllFindings = () => {
    if (!report?.findings) return;
    setExpandedFindings(new Set(report.findings.map((f) => f.id)));
  };

  const collapseAllFindings = () => {
    setExpandedFindings(new Set());
  };

  const handleCopyMarkdown = () => {
    if (!report?.body_md) return;
    navigator.clipboard.writeText(cleanBody);
    setCopiedMd(true);
    toast.success('Report markdown copied to clipboard');
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleCopySummary = () => {
    if (!report?.executive_summary) return;
    navigator.clipboard.writeText(report.executive_summary);
    setCopiedSummary(true);
    toast.success('Executive summary copied');
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleExportJSON = () => {
    if (!report) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `report-${report.id.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Report JSON downloaded');
  };

  // Distinct domains present in findings/sources
  const availableDomains = useMemo(() => {
    const set = new Set<string>();
    if (report?.sources) {
      report.sources.forEach((s) => s.domain && set.add(s.domain.toLowerCase()));
    }
    if (report?.findings) {
      report.findings.forEach((f) => f.source_domain && set.add(f.source_domain.toLowerCase()));
    }
    return Array.from(set).sort();
  }, [report]);

  // Filtered findings list based on status, domain, and live search
  const filteredFindings = useMemo(() => {
    const list = report?.findings || [];
    return list.filter((f) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const st = f.verification_status.toUpperCase();
        if (statusFilter === 'SUPPORTED' && st !== 'SUPPORTED') return false;
        if (statusFilter === 'PARTIALLY_SUPPORTED' && st !== 'PARTIALLY_SUPPORTED') return false;
        if (statusFilter === 'CONTRADICTED' && !(st === 'CONTRADICTED' || st === 'MIXED_EVIDENCE')) return false;
        if (statusFilter === 'UNVERIFIED' && !(st === 'UNVERIFIED' || st === 'INSUFFICIENT_EVIDENCE' || st === 'UNVERIFIABLE')) return false;
      }

      // Domain filter
      if (domainFilter !== 'ALL') {
        if (!f.source_domain || f.source_domain.toLowerCase() !== domainFilter.toLowerCase()) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inClaim = f.claim_text.toLowerCase().includes(q);
        const inDomain = (f.source_domain || '').toLowerCase().includes(q);
        const inRationale = (f.confidence_rationale || '').toLowerCase().includes(q);
        const inExcerpts = f.evidence_excerpts.some((exc) => exc.toLowerCase().includes(q));
        if (!inClaim && !inDomain && !inRationale && !inExcerpts) return false;
      }

      return true;
    });
  }, [report?.findings, statusFilter, domainFilter, searchQuery]);

  // Visual Chart Data 1: Verification Stance Distribution
  const verificationChartData = useMemo(() => {
    const m = report?.metrics;
    if (!m) return [];
    return [
      { name: 'Supported', value: m.supported_count, color: VERIFICATION_COLORS['SUPPORTED'] },
      { name: 'Partially Supported', value: m.partially_supported_count, color: VERIFICATION_COLORS['PARTIALLY_SUPPORTED'] },
      { name: 'Contradicted', value: m.contradicted_count, color: VERIFICATION_COLORS['CONTRADICTED'] },
      { name: 'Unverified', value: m.unverified_count, color: VERIFICATION_COLORS['UNVERIFIED'] },
    ].filter((d) => d.value > 0);
  }, [report?.metrics]);

  // Visual Chart Data 2: Citations per Domain
  const domainCitationChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of report?.findings || []) {
      const dom = f.source_domain || 'Unknown';
      map[dom] = (map[dom] || 0) + 1;
    }
    return Object.entries(map)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [report?.findings]);

  // Source-to-Claim Mapping for Matrix View
  const sourceToClaimsMap = useMemo(() => {
    const map = new Map<string, { domain: string; claims: ReportFinding[] }>();

    for (const f of report?.findings || []) {
      const url = f.source_url || 'Unspecified URL';
      const domain = f.source_domain || 'Unattributed';
      if (!map.has(url)) {
        map.set(url, { domain, claims: [] });
      }
      map.get(url)!.claims.push(f);
    }

    // Also include any sources that had no direct finding matches
    for (const s of report?.sources || []) {
      if (!map.has(s.url)) {
        map.set(s.url, { domain: s.domain, claims: [] });
      }
    }

    return Array.from(map.entries()).map(([url, data]) => ({
      url,
      domain: data.domain,
      claims: data.claims,
    }));
  }, [report?.findings, report?.sources]);

  if (loading) {
    return <SkeletonCard rows={8} />;
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Reports Archive</span>
        </button>
        <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error || 'Unable to load report'}
        </div>
      </div>
    );
  }

  const metrics = report.metrics || {
    unique_sources_count: 0,
    unique_domains_count: 0,
    total_discoveries_count: report.discovery_ids?.length || 0,
    total_claims_count: report.findings?.length || 0,
    supported_count: 0,
    partially_supported_count: 0,
    contradicted_count: 0,
    unverified_count: 0,
  };

  const totalEvaluated =
    metrics.supported_count +
    metrics.partially_supported_count +
    metrics.contradicted_count +
    metrics.unverified_count || 1;

  const supportedPct = Math.round((metrics.supported_count / totalEvaluated) * 100);
  const partialPct = Math.round((metrics.partially_supported_count / totalEvaluated) * 100);
  const contradictedPct = Math.round((metrics.contradicted_count / totalEvaluated) * 100);
  const unverifiedPct = Math.round((metrics.unverified_count / totalEvaluated) * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Reports Archive</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535] transition-colors"
            title="Copy Executive Summary"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
          </button>
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535] transition-colors"
            title="Copy Report in GitHub Flavored Markdown"
          >
            {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedMd ? 'Copied' : 'Copy Markdown'}</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
            title="Export Report Metadata & Findings as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Header Dossier Overview Card */}
      <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-6 sm:p-7 space-y-4 shadow-xl shadow-black/30">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              {new Date(report.created_at).toLocaleString()}
            </span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Task: {report.task_id ? report.task_id.slice(0, 8) : 'Manual Run'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2.5 py-0.5 rounded bg-[#161B27] border border-[#1E2535] text-slate-300">
              {metrics.total_discoveries_count} Discoveries
            </span>
            <span className="px-2.5 py-0.5 rounded bg-[#161B27] border border-[#1E2535] text-slate-300">
              {metrics.unique_sources_count} Unique Sources
            </span>
            <span className="px-2.5 py-0.5 rounded bg-[#161B27] border border-[#1E2535] text-slate-300">
              {metrics.unique_domains_count} Domains
            </span>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight leading-snug">
          {report.title}
        </h1>

        <div className="p-3.5 rounded-lg bg-[#0E1118] border border-[#1E2535] text-xs text-slate-300 flex items-start gap-2.5">
          <Search className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
              Original Research Prompt
            </span>
            <p className="font-mono text-slate-200">{report.query}</p>
          </div>
        </div>
      </div>

      {/* Verification Metrics & Visual Analytics Ribbon */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Verification 4-Card Grid (Left 2 cols) */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => setStatusFilter(statusFilter === 'SUPPORTED' ? 'ALL' : 'SUPPORTED')}
            className={`p-4 rounded-xl bg-[#11151E] border cursor-pointer transition-all ${
              statusFilter === 'SUPPORTED' ? 'border-emerald-500 bg-emerald-500/5' : 'border-[#1E2535] hover:border-emerald-500/40'
            }`}
          >
            <div className="text-[11px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supported</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {metrics.supported_count}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">{supportedPct}% of evaluated claims</p>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'PARTIALLY_SUPPORTED' ? 'ALL' : 'PARTIALLY_SUPPORTED')}
            className={`p-4 rounded-xl bg-[#11151E] border cursor-pointer transition-all ${
              statusFilter === 'PARTIALLY_SUPPORTED' ? 'border-amber-500 bg-amber-500/5' : 'border-[#1E2535] hover:border-amber-500/40'
            }`}
          >
            <div className="text-[11px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>Partial</span>
            </div>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {metrics.partially_supported_count}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">{partialPct}% incomplete details</p>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'CONTRADICTED' ? 'ALL' : 'CONTRADICTED')}
            className={`p-4 rounded-xl bg-[#11151E] border cursor-pointer transition-all ${
              statusFilter === 'CONTRADICTED' ? 'border-rose-500 bg-rose-500/5' : 'border-[#1E2535] hover:border-rose-500/40'
            }`}
          >
            <div className="text-[11px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Contradicted</span>
            </div>
            <div className="text-2xl font-bold text-rose-400 font-mono">
              {metrics.contradicted_count}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">{contradictedPct}% conflicting</p>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'UNVERIFIED' ? 'ALL' : 'UNVERIFIED')}
            className={`p-4 rounded-xl bg-[#11151E] border cursor-pointer transition-all ${
              statusFilter === 'UNVERIFIED' ? 'border-slate-400 bg-slate-500/5' : 'border-[#1E2535] hover:border-slate-400/40'
            }`}
          >
            <div className="text-[11px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Unverified</span>
            </div>
            <div className="text-2xl font-bold text-slate-300 font-mono">
              {metrics.unverified_count}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">{unverifiedPct}% text unbacked</p>
          </div>
        </div>

        {/* Stance Chart / Bar Mini Visualizer (Right 1 col) */}
        <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold text-slate-200">Verification Stance Ratio</span>
            <span className="font-mono text-[11px]">{metrics.total_claims_count} total claims</span>
          </div>

          {/* Segmented Integrity Progress Bar */}
          <div className="h-2.5 w-full bg-[#0E1118] rounded-full overflow-hidden flex border border-[#1E2535] my-2">
            <div style={{ width: `${supportedPct}%` }} className="bg-emerald-500 transition-all duration-300" title={`Supported: ${metrics.supported_count}`} />
            <div style={{ width: `${partialPct}%` }} className="bg-amber-500 transition-all duration-300" title={`Partially Supported: ${metrics.partially_supported_count}`} />
            <div style={{ width: `${contradictedPct}%` }} className="bg-rose-500 transition-all duration-300" title={`Contradicted: ${metrics.contradicted_count}`} />
            <div style={{ width: `${unverifiedPct}%` }} className="bg-slate-600 transition-all duration-300" title={`Unverified: ${metrics.unverified_count}`} />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="text-emerald-400 font-mono">{supportedPct}% Verified</span>
            <span className="text-slate-500 font-mono">{unverifiedPct}% Needs Proof</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-[#1E2535] text-xs">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'summary'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Interactive Findings Dossier</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#161B27] text-[10px] text-slate-300 font-mono">
            {report.findings?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'matrix'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Source-to-Claim Map</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#161B27] text-[10px] text-slate-300 font-mono">
            {sourceToClaimsMap.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'sources'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Source Provenance & Domains</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#161B27] text-[10px] text-slate-300 font-mono">
            {metrics.unique_domains_count}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dossier')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'dossier'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Full Markdown View</span>
        </button>
      </div>

      {/* Tab 1: Interactive Findings Dossier */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          {report.executive_summary && (
            <div className="p-6 rounded-xl bg-gradient-to-br from-[#121826] to-[#0E1118] border border-indigo-500/20 shadow-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Executive Summary & Key Takeaways</span>
                </div>
                <button
                  onClick={handleCopySummary}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans font-normal">
                {report.executive_summary}
              </p>
            </div>
          )}

          {/* Limitations Banner */}
          {report.limitations && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold block mb-0.5">Methodology & Research Scope Boundaries</span>
                <p className="leading-relaxed opacity-90">{report.limitations}</p>
              </div>
            </div>
          )}

          {/* Findings Filter Bar */}
          <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search claims, domains, or evidence excerpts..."
                  className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Expand / Collapse All buttons */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={expandAllFindings}
                  className="px-2.5 py-1 rounded bg-[#161B27] hover:bg-[#1C2232] text-slate-300 border border-[#1E2535] transition-colors"
                >
                  Expand All Excerpts
                </button>
                <button
                  onClick={collapseAllFindings}
                  className="px-2.5 py-1 rounded bg-[#161B27] hover:bg-[#1C2232] text-slate-300 border border-[#1E2535] transition-colors"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Status & Domain Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1E2535]">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 text-[10px] uppercase font-semibold mr-1">Status:</span>
                {(['ALL', 'SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'UNVERIFIED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      statusFilter === st
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-[#0E1118] text-slate-400 hover:text-slate-200 border border-[#1E2535]'
                    }`}
                  >
                    {st === 'ALL' ? 'All Findings' : st.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {availableDomains.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Domain:</span>
                  <select
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="bg-[#0E1118] border border-[#1E2535] rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Domains ({availableDomains.length})</option>
                    {availableDomains.map((dom) => (
                      <option key={dom} value={dom}>
                        {dom}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Two-Column Explorer: Finding Cards on Left, Evidence Inspector on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Finding Cards List (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing {filteredFindings.length} of {report.findings?.length || 0} findings
                </span>
                {(statusFilter !== 'ALL' || domainFilter !== 'ALL' || searchQuery) && (
                  <button
                    onClick={() => {
                      setStatusFilter('ALL');
                      setDomainFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {filteredFindings.length > 0 ? (
                filteredFindings.map((finding) => {
                  const isExpanded = expandedFindings.has(finding.id);
                  const isSelected = selectedFinding?.id === finding.id;
                  const status = finding.verification_status.toUpperCase();

                  let badgeColor = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                  let Icon = HelpCircle;

                  if (status === 'SUPPORTED') {
                    badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    Icon = CheckCircle2;
                  } else if (status === 'PARTIALLY_SUPPORTED') {
                    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    Icon = Scale;
                  } else if (status === 'CONTRADICTED' || status === 'MIXED_EVIDENCE') {
                    badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    Icon = XCircle;
                  }

                  return (
                    <div
                      key={finding.id}
                      onClick={() => setSelectedFinding(finding)}
                      className={`p-4 rounded-xl bg-[#11151E] border cursor-pointer transition-all space-y-2.5 ${
                        isSelected
                          ? 'border-indigo-500 ring-1 ring-indigo-500/40 bg-[#141A28]'
                          : 'border-[#1E2535] hover:border-[#283248]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${badgeColor}`}>
                              <Icon className="w-3 h-3" />
                              <span>{status}</span>
                            </span>

                            {finding.source_domain && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono px-2 py-0.5 rounded bg-[#0E1118] border border-[#1E2535]">
                                <Globe className="w-3 h-3 text-indigo-400" />
                                <span>{finding.source_domain}</span>
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm font-medium text-slate-100 leading-snug">
                            {finding.claim_text}
                          </p>
                        </div>

                        {finding.source_url && (
                          <a
                            href={finding.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded bg-[#161B27] border border-[#1E2535] flex-shrink-0"
                            title="Open original source"
                          >
                            <span>Source</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Excerpt toggle button */}
                      {finding.evidence_excerpts && finding.evidence_excerpts.length > 0 && (
                        <div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFinding(finding.id);
                            }}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>
                              {isExpanded ? 'Hide' : 'Inspect'} Grounding Excerpt ({finding.evidence_excerpts.length})
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-1.5 animate-fade-in">
                              {finding.evidence_excerpts.map((exc, idx) => (
                                <blockquote
                                  key={idx}
                                  className="border-l-2 border-indigo-500 pl-3 py-1 text-xs text-slate-300 italic bg-[#0E1118]/80 rounded-r"
                                >
                                  &ldquo;{exc}&rdquo;
                                </blockquote>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center rounded-xl bg-[#11151E] border border-[#1E2535] text-slate-400 text-xs">
                  No findings match the selected status, domain, or search criteria.
                </div>
              )}
            </div>

            {/* Dedicated Evidence Inspector Panel on Right (5 cols) */}
            <div className="lg:col-span-5">
              <div className="sticky top-20 p-5 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#1E2535] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Evidence Inspector
                    </span>
                  </div>
                  {selectedFinding && (
                    <span className="text-[10px] font-mono text-slate-500">
                      ID: {selectedFinding.id}
                    </span>
                  )}
                </div>

                {selectedFinding ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                        Selected Claim Statement
                      </span>
                      <p className="text-xs font-semibold text-slate-100 leading-relaxed bg-[#0E1118] p-3 rounded-lg border border-[#1E2535]">
                        {selectedFinding.claim_text}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                        Verification Status & Rationale
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold font-mono border ${
                          selectedFinding.verification_status === 'SUPPORTED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : selectedFinding.verification_status === 'PARTIALLY_SUPPORTED'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {selectedFinding.verification_status}
                        </span>
                        {selectedFinding.source_domain && (
                          <span className="text-xs font-mono text-slate-400">
                            via {selectedFinding.source_domain}
                          </span>
                        )}
                      </div>

                      {selectedFinding.confidence_rationale && (
                        <p className="text-xs text-slate-300 bg-[#0E1118] p-2.5 rounded-lg border border-[#1E2535] leading-relaxed">
                          {selectedFinding.confidence_rationale}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                        Supporting Evidence Excerpts
                      </span>
                      {selectedFinding.evidence_excerpts && selectedFinding.evidence_excerpts.length > 0 ? (
                        <div className="space-y-2">
                          {selectedFinding.evidence_excerpts.map((exc, idx) => (
                            <blockquote
                              key={idx}
                              className="border-l-2 border-indigo-500 pl-3 py-1.5 text-xs text-slate-300 italic bg-[#0E1118] rounded-r leading-relaxed"
                            >
                              &ldquo;{exc}&rdquo;
                            </blockquote>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic bg-[#0E1118] p-3 rounded-lg border border-[#1E2535]">
                          No direct textual excerpts extracted for this statement. Marked as unverified until corroborating sources are inspected.
                        </p>
                      )}
                    </div>

                    {selectedFinding.source_url && (
                      <div className="pt-2 border-t border-[#1E2535]">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                          Canonical Citation
                        </span>
                        <a
                          href={selectedFinding.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 truncate"
                        >
                          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{selectedFinding.source_url}</span>
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    Select a finding card to inspect its evidence and verification details.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Source-to-Claim Map */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-200 block">Source-to-Claim Mapping Matrix</span>
              <span className="text-slate-400 text-[11px]">
                Cross-reference which web sources support which specific intelligence claims.
              </span>
            </div>
            <span className="font-mono text-indigo-400 text-[11px]">
              {sourceToClaimsMap.length} Linked Sources
            </span>
          </div>

          <div className="space-y-4">
            {sourceToClaimsMap.map((srcItem, idx) => (
              <div key={idx} className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2535] pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-[#161B27] border border-[#1E2535] text-[10px] font-mono text-indigo-400 flex-shrink-0">
                      {srcItem.domain}
                    </span>
                    <a
                      href={srcItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-slate-200 hover:text-indigo-400 truncate flex items-center gap-1"
                    >
                      <span className="truncate">{srcItem.url}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                  <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                    Supports {srcItem.claims.length} claim(s)
                  </span>
                </div>

                {srcItem.claims.length > 0 ? (
                  <div className="space-y-2">
                    {srcItem.claims.map((claim) => (
                      <div
                        key={claim.id}
                        className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535] flex items-start justify-between gap-3 text-xs"
                      >
                        <p className="text-slate-200 leading-relaxed">{claim.claim_text}</p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono flex-shrink-0 border ${
                          claim.verification_status === 'SUPPORTED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {claim.verification_status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Source inspected during research crawl but did not yield extracted claims in this synthesis.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Source Provenance & Domains */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          {/* Domain Citation Chart */}
          {domainCitationChartData.length > 0 && (
            <div className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Domain Citation Frequency
                  </h3>
                  <p className="text-[11px] text-slate-400">Claims grounded per external domain</p>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {metrics.unique_domains_count} unique domains
                </span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={domainCitationChartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                    <XAxis dataKey="domain" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0E1118', borderColor: '#1E2535', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#E2E8F0' }}
                    />
                    <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="divide-y divide-[#1E2535] rounded-xl border border-[#1E2535] bg-[#11151E] overflow-hidden">
            {report.sources && report.sources.length > 0 ? (
              report.sources.map((src, index) => (
                <div key={index} className="p-4 flex items-center justify-between gap-4 hover:bg-[#161B27]/40 transition-colors">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#0E1118] border border-[#1E2535] text-[10px] font-mono text-indigo-400">
                        {src.domain}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-300 truncate" title={src.url}>
                      {src.url}
                    </p>
                  </div>

                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg bg-[#161B27] border border-[#1E2535] flex-shrink-0"
                  >
                    <span>Visit Source</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No individual source URLs extracted in this report.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Full Markdown View */}
      {activeTab === 'dossier' && (
        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-6 sm:p-8 space-y-4">
          <div className="prose prose-invert prose-indigo max-w-none text-xs text-slate-300 leading-relaxed font-sans">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => (
                  <h1 className="text-xl font-bold text-slate-100 mt-6 mb-3 border-b border-[#1E2535] pb-2" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-base font-semibold text-slate-100 mt-6 mb-2 text-indigo-300" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-sm font-semibold text-slate-200 mt-4 mb-2" {...props} />
                ),
                p: ({ node, ...props }) => <p className="mb-3 leading-relaxed text-slate-300" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1.5 mb-4 text-slate-300" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1.5 mb-4 text-slate-300" {...props} />,
                li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                a: ({ node, href, children, ...props }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium inline-flex items-center gap-0.5"
                    {...props}
                  >
                    <span>{children}</span>
                    <ExternalLink className="w-2.5 h-2.5 inline opacity-70" />
                  </a>
                ),
                table: ({ node, ...props }) => (
                  <div className="my-5 overflow-x-auto rounded-lg border border-[#1E2535]">
                    <table className="w-full text-left text-[11px] border-collapse bg-[#0E1118]" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-[#161B27] border-b border-[#1E2535] text-slate-200" {...props} />
                ),
                th: ({ node, ...props }) => <th className="p-2.5 font-semibold text-slate-200" {...props} />,
                td: ({ node, ...props }) => <td className="p-2.5 border-t border-[#1E2535]/60 align-top text-slate-300" {...props} />,
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-2 border-indigo-500 pl-3 my-3 italic text-slate-400 bg-[#0E1118]/60 p-2.5 rounded" {...props} />
                ),
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code className="bg-[#161B27] px-1.5 py-0.5 rounded text-[11px] font-mono text-indigo-300 border border-[#1E2535]" {...props} />
                  ) : (
                    <pre className="bg-[#0E1118] p-3 rounded-lg border border-[#1E2535] overflow-x-auto my-3">
                      <code className="text-[11px] font-mono text-slate-300" {...props} />
                    </pre>
                  ),
              }}
            >
              {cleanBody}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

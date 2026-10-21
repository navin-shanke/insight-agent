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
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { fetchReport } from '../api/reports';
import { Report } from '../types';

function cleanMarkdownText(text: string): string {
  if (!text) return '';
  let cleaned = text.replace(/\\([#*\[\]_`])/g, '$1');
  cleaned = cleaned.replace(/^\s*svg\s*$/gim, '');
  cleaned = cleaned.replace(/ClaimVerdict\./g, '');
  return cleaned;
}

export const ReportDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'summary' | 'dossier' | 'sources'
  const [activeTab, setActiveTab] = useState<'summary' | 'dossier' | 'sources'>('summary');

  // Status Filter for findings
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Expanded evidence drawer states (set of finding IDs)
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

  // Copy feedback state
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchReport(id)
      .then(setReport)
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

  const handleCopyMarkdown = () => {
    if (!report?.body_md) return;
    navigator.clipboard.writeText(cleanBody);
    setCopied(true);
    toast.success('Report markdown copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
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

  const filteredFindings = useMemo(() => {
    const list = report?.findings || [];
    if (statusFilter === 'ALL') return list;
    return list.filter((f) => {
      const st = f.verification_status.toUpperCase();
      if (statusFilter === 'SUPPORTED') return st === 'SUPPORTED';
      if (statusFilter === 'PARTIALLY_SUPPORTED') return st === 'PARTIALLY_SUPPORTED';
      if (statusFilter === 'CONTRADICTED') return st === 'CONTRADICTED' || st === 'MIXED_EVIDENCE';
      if (statusFilter === 'UNVERIFIED') return st === 'UNVERIFIED' || st === 'INSUFFICIENT_EVIDENCE' || st === 'UNVERIFIABLE';
      return true;
    });
  }, [report?.findings, statusFilter]);

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
          <span>Back to Reports</span>
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

  const supportedPct = (metrics.supported_count / totalEvaluated) * 100;
  const partialPct = (metrics.partially_supported_count / totalEvaluated) * 100;
  const contradictedPct = (metrics.contradicted_count / totalEvaluated) * 100;
  const unverifiedPct = (metrics.unverified_count / totalEvaluated) * 100;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Report Archive</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535] transition-colors"
            title="Copy Report in GitHub Flavored Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535] transition-colors"
            title="Export Report Metadata & Findings as JSON"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Header Intelligence Card */}
      <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-6 sm:p-7 space-y-4 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              {new Date(report.created_at).toLocaleString()}
            </span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Task: {report.task_id ? report.task_id.slice(0, 8) : 'Manual'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-[#161B27] border border-[#1E2535] text-slate-300">
              {metrics.total_discoveries_count} Discoveries
            </span>
            <span className="px-2 py-0.5 rounded bg-[#161B27] border border-[#1E2535] text-slate-300">
              {metrics.unique_sources_count} Unique Sources
            </span>
            <span className="px-2 py-0.5 rounded bg-[#161B27] border border-[#1E2535] text-slate-300">
              {metrics.unique_domains_count} Domains
            </span>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight leading-snug">
          {report.title}
        </h1>

        <div className="p-3.5 rounded-lg bg-[#0E1118] border border-[#1E2535] text-xs text-slate-300 flex items-start gap-2.5">
          <Search className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
              Original Research Prompt
            </span>
            <p className="font-mono text-slate-200">{report.query}</p>
          </div>
        </div>
      </div>

      {/* Provenance & Verification Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535]">
          <div className="text-[11px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Supported</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {metrics.supported_count}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Explicit source corroboration</p>
        </div>

        <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535]">
          <div className="text-[11px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>Partially Supported</span>
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {metrics.partially_supported_count}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Key details unverified/partial</p>
        </div>

        <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535]">
          <div className="text-[11px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Contradicted / Mixed</span>
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            {metrics.contradicted_count}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Conflicting evidence observed</p>
        </div>

        <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535]">
          <div className="text-[11px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Unverified Claims</span>
          </div>
          <div className="text-2xl font-bold text-slate-300 font-mono">
            {metrics.unverified_count}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Lacks textual substantiation</p>
        </div>
      </div>

      {/* Segmented Verification Distribution Bar */}
      <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Verification Integrity Breakdown</span>
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {metrics.total_claims_count} total claims evaluated
          </span>
        </div>

        <div className="h-2 w-full bg-[#0E1118] rounded-full overflow-hidden flex border border-[#1E2535]">
          <div style={{ width: `${supportedPct}%` }} className="bg-emerald-500 transition-all duration-300" title={`Supported: ${metrics.supported_count}`} />
          <div style={{ width: `${partialPct}%` }} className="bg-amber-500 transition-all duration-300" title={`Partially Supported: ${metrics.partially_supported_count}`} />
          <div style={{ width: `${contradictedPct}%` }} className="bg-rose-500 transition-all duration-300" title={`Contradicted: ${metrics.contradicted_count}`} />
          <div style={{ width: `${unverifiedPct}%` }} className="bg-slate-600 transition-all duration-300" title={`Unverified: ${metrics.unverified_count}`} />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 pt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Supported ({Math.round(supportedPct)}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Partially Supported ({Math.round(partialPct)}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Contradicted ({Math.round(contradictedPct)}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            <span>Unverified ({Math.round(unverifiedPct)}%)</span>
          </span>
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
          <span>Executive Intelligence & Findings</span>
          {report.findings && report.findings.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#161B27] text-[10px] text-slate-300 font-mono">
              {report.findings.length}
            </span>
          )}
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
          <span>Full Markdown Dossier</span>
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
          <span>Source Provenance & Audit</span>
          {metrics.unique_sources_count > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#161B27] text-[10px] text-slate-300 font-mono">
              {metrics.unique_sources_count}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Executive Intelligence & Findings */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          {report.executive_summary && (
            <div className="p-6 rounded-xl bg-gradient-to-br from-[#121826] to-[#0E1118] border border-indigo-500/20 shadow-md">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Executive Summary</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans font-normal">
                {report.executive_summary}
              </p>
            </div>
          )}

          {/* Limitations & Scope Banner */}
          {report.limitations && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold block mb-0.5">Methodology & Research Limitations</span>
                <p className="leading-relaxed opacity-90">{report.limitations}</p>
              </div>
            </div>
          )}

          {/* Findings Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Key Research Findings</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  ({filteredFindings.length} of {report.findings?.length || 0})
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Atomic factual claims extracted and verified against snapshot evidence.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {(['ALL', 'SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'UNVERIFIED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-[#11151E] text-slate-400 hover:text-slate-200 border border-[#1E2535]'
                  }`}
                >
                  {st === 'ALL' ? 'All Findings' : st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Findings Cards List */}
          {filteredFindings.length > 0 ? (
            <div className="space-y-3">
              {filteredFindings.map((finding) => {
                const isExpanded = expandedFindings.has(finding.id);
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
                    className="p-4 sm:p-5 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-[#283248] transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${badgeColor}`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{status}</span>
                          </span>

                          {finding.source_domain && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono px-2 py-0.5 rounded bg-[#0E1118] border border-[#1E2535]">
                              <Globe className="w-3 h-3 text-indigo-400" />
                              <span>{finding.source_domain}</span>
                            </span>
                          )}

                          {finding.category && (
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-mono">
                              {finding.category}
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-slate-100 leading-relaxed font-sans">
                          {finding.claim_text}
                        </p>
                      </div>

                      {finding.source_url && (
                        <a
                          href={finding.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded bg-[#161B27] border border-[#1E2535] transition-colors flex-shrink-0"
                          title="Open original source article"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Rationale or Notes */}
                    {finding.confidence_rationale && (
                      <p className="text-xs text-slate-400 bg-[#0E1118] p-2.5 rounded-lg border border-[#1E2535] leading-relaxed">
                        <span className="text-slate-500 font-semibold uppercase text-[10px] block mb-0.5">
                          Verification Rationale
                        </span>
                        {finding.confidence_rationale}
                      </p>
                    )}

                    {/* Expandable Evidence Excerpts */}
                    {finding.evidence_excerpts && finding.evidence_excerpts.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleFinding(finding.id)}
                          className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span>
                            {isExpanded ? 'Hide' : 'Inspect'} Grounding Excerpt ({finding.evidence_excerpts.length})
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 animate-fade-in">
                            {finding.evidence_excerpts.map((exc, idx) => (
                              <blockquote
                                key={idx}
                                className="border-l-2 border-indigo-500 pl-3 py-1.5 text-xs text-slate-300 italic bg-[#0E1118]/80 rounded-r"
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
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-[#11151E] border border-[#1E2535] text-slate-400 text-xs">
              No findings match the selected status filter.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Full Markdown Dossier */}
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

      {/* Tab 3: Source Provenance & Audit */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-200 block">Inspected Source Ledger</span>
              <span className="text-slate-400 text-[11px]">
                {metrics.unique_sources_count} unique web sources analyzed across {metrics.unique_domains_count} domains.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#161B27] border border-[#1E2535] text-slate-300 text-[11px] font-mono">
                Provider: DuckDuckGo
              </span>
            </div>
          </div>

          {report.sources && report.sources.length > 0 ? (
            <div className="divide-y divide-[#1E2535] rounded-xl border border-[#1E2535] bg-[#11151E] overflow-hidden">
              {report.sources.map((src, index) => (
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
                    <span>Visit</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-[#11151E] border border-[#1E2535] text-slate-400 text-xs">
              No individual source URLs extracted in this report.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

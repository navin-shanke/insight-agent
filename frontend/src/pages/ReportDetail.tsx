import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, AlertTriangle, ExternalLink, Globe, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { fetchReport } from '../api/reports';
import { Report } from '../types';

function cleanMarkdownText(text: string): string {
  if (!text) return '';
  // Unescape backslash-escaped markdown markers (\#, \*, \[, \], \_)
  let cleaned = text.replace(/\\([#*\[\]_`])/g, '$1');
  // Remove standalone stray svg lines
  cleaned = cleaned.replace(/^\s*svg\s*$/gim, '');
  // Remove ClaimVerdict. prefix if present
  cleaned = cleaned.replace(/ClaimVerdict\./g, '');
  return cleaned;
}

export const ReportDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return <SkeletonCard rows={6} />;
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <button
        onClick={() => navigate('/reports')}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Reports</span>
      </button>

      {/* Report Header Card */}
      <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {new Date(report.created_at).toLocaleString()}
          </span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {report.discovery_ids?.length || 0} discoveries linked
          </span>
        </div>

        <h1 className="text-xl font-bold text-slate-100 leading-tight">
          {report.title}
        </h1>

        <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535] text-xs text-slate-300 font-mono">
          <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">
            Research Objective
          </span>
          {report.query}
        </div>
      </div>

      {/* Limitations / Caveats Box */}
      {report.limitations && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <div>
            <span className="font-semibold block mb-0.5">Investigation Limitations & Methodology</span>
            <p className="leading-relaxed opacity-90">{report.limitations}</p>
          </div>
        </div>
      )}

      {/* Rendered Markdown Body */}
      <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-6 md:p-8 space-y-4">
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
    </div>
  );
};

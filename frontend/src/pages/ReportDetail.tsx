import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, AlertTriangle, Layers, Clock } from 'lucide-react';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { fetchReport } from '../api/reports';
import { Report } from '../types';

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
      .catch((err) => setError('Report not found'))
      .finally(() => setLoading(false));
  }, [id]);

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

      {/* Report Header */}
      <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {new Date(report.created_at).toLocaleString()}
          </span>
          <span>•</span>
          <span className="text-indigo-400">
            {report.discovery_ids?.length || 0} discoveries linked
          </span>
        </div>

        <h1 className="text-xl font-bold text-slate-100 leading-tight">
          {report.title}
        </h1>

        <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535] text-xs text-slate-300 font-mono">
          <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">
            Original Query
          </span>
          {report.query}
        </div>
      </div>

      {/* Limitations / Caveats Box */}
      {report.limitations && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <div>
            <span className="font-semibold block mb-0.5">Investigation Limitations & Caveats</span>
            <p className="leading-relaxed opacity-90">{report.limitations}</p>
          </div>
        </div>
      )}

      {/* Report Body Markdown Presentation */}
      <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-6 md:p-8 space-y-4 leading-relaxed text-xs text-slate-300">
        <div className="prose prose-invert prose-indigo max-w-none text-xs whitespace-pre-wrap font-sans">
          {report.body_md || report.summary || 'No markdown body available.'}
        </div>
      </div>
    </div>
  );
};

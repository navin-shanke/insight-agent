import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Radio,
  Filter,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react';
import { TaskStatusBadge } from '../design-system/components/TaskStatusBadge';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchDiscoveries } from '../api/discoveries';
import { Discovery } from '../types';

export const IntelligenceFeed: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';

  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(qParam);
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchDiscoveries({
        q: searchTerm.trim() || undefined,
        verification_status: statusFilter || undefined,
        page_size: 50,
      });
      setDiscoveries(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Intelligence Feed
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Continuously updated stream of factual findings extracted from accessible web sources.
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2.5">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter findings..."
              className="bg-[#11151E] border border-[#1E2535] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50"
            />
          </form>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#11151E] border border-[#1E2535] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="">All Statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="UNVERIFIED">Unverified</option>
            <option value="DISPUTED">Disputed</option>
          </select>
        </div>
      </div>

      {/* Discovery Cards Feed */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : discoveries.length > 0 ? (
        <div className="space-y-4">
          {discoveries.map((item) => (
            <div
              key={item.id}
              className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 hover:border-[#2A3449] transition-all space-y-3 shadow-sm group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {item.category || 'Discovery'}
                    </span>
                    <TaskStatusBadge status={item.verification_status} size="sm" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-200 transition-colors">
                    {item.title}
                  </h3>
                </div>

                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {item.summary}
              </p>

              {/* Source Provenance Pills */}
              {item.sources && item.sources.length > 0 && (
                <div className="pt-2 border-t border-[#1E2535]/70 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    Sources ({item.sources.length}):
                  </span>
                  {item.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#161B27] hover:bg-[#1E2538] text-slate-300 hover:text-indigo-300 border border-[#1E2535] transition-colors max-w-xs truncate"
                    >
                      <span className="truncate">{src.title || src.url}</span>
                      <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Radio}
          title="No Discoveries Found"
          description="Autonomous research tasks evaluate and extract verified factual claims into this feed."
        />
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  SearchCode,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Quote,
  Layers,
} from 'lucide-react';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchClaims } from '../api/evidence';
import { Claim } from '../types';

export const EvidenceExplorer: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchClaims({ q: searchTerm.trim() || undefined, page_size: 50 });
      setClaims(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SearchCode className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Evidence Explorer
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Fine-grained provenance ledger: inspect claims, supporting excerpts, source URLs, and stances.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadData();
          }}
          className="relative"
        >
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search claim text..."
            className="bg-[#11151E] border border-[#1E2535] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50"
          />
        </form>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : claims.length > 0 ? (
        <div className="space-y-3">
          {claims.map((claim) => {
            const isExpanded = expandedClaimId === claim.id;

            return (
              <div
                key={claim.id}
                className="bg-[#11151E] border border-[#1E2535] rounded-xl overflow-hidden transition-all duration-200"
              >
                <div
                  onClick={() => setExpandedClaimId(isExpanded ? null : claim.id)}
                  className="p-4 cursor-pointer hover:bg-[#161B27]/40 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {claim.category || 'Claim'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {claim.evidence?.length || 0} evidence excerpts
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 leading-snug">
                      "{claim.text}"
                    </p>
                  </div>

                  <button className="text-slate-400 p-1 flex-shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#1E2535] bg-[#0E1118]/50 space-y-3">
                    <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      Grounding Evidence & Citations
                    </div>

                    {claim.evidence && claim.evidence.length > 0 ? (
                      <div className="space-y-2.5">
                        {claim.evidence.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-3 rounded-lg bg-[#11151E] border border-[#1E2535] space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono text-[10px] uppercase">
                                Stance: {ev.stance}
                              </span>
                              {ev.source_url && (
                                <a
                                  href={ev.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-mono text-[10px]"
                                >
                                  <span>View Original Source</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>

                            <blockquote className="p-2.5 rounded bg-[#0E1118] border-l-2 border-indigo-500/50 text-[11px] text-slate-300 italic">
                              "{ev.excerpt}"
                            </blockquote>

                            {ev.quality_notes && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                Quality notes: {ev.quality_notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No attached evidence excerpts found.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={SearchCode}
          title="No Extracted Claims"
          description="Autonomous research parses claims from retrieved content and correlates them with multi-source evidence."
        />
      )}
    </div>
  );
};

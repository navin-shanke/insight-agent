import React, { useEffect, useState, useMemo } from 'react';
import {
  SearchCode,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Quote,
  Layers,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Globe,
  SlidersHorizontal,
  X,
  Copy,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchClaims } from '../api/evidence';
import { Claim, Evidence } from '../types';

export const EvidenceExplorer: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStance, setSelectedStance] = useState<string>('ALL');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchClaims({ q: searchTerm.trim() || undefined, page_size: 100 });
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

  // Compute available categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    claims.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats);
  }, [claims]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalExcerpts = 0;
    let supportCount = 0;
    let contradictCount = 0;
    let neutralCount = 0;

    claims.forEach((c) => {
      if (c.evidence) {
        totalExcerpts += c.evidence.length;
        c.evidence.forEach((ev) => {
          const s = ev.stance?.toUpperCase();
          if (s === 'SUPPORT' || s === 'SUPPORTED') supportCount++;
          else if (s === 'CONTRADICT' || s === 'CONTRADICTED') contradictCount++;
          else neutralCount++;
        });
      }
    });

    return {
      totalClaims: claims.length,
      totalExcerpts,
      supportCount,
      contradictCount,
      neutralCount,
    };
  }, [claims]);

  // Filtered claims
  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesText = claim.text?.toLowerCase().includes(term);
        const matchesCategory = claim.category?.toLowerCase().includes(term);
        const matchesEvidence = claim.evidence?.some(
          (e) => e.excerpt?.toLowerCase().includes(term) || e.source_url?.toLowerCase().includes(term)
        );
        if (!matchesText && !matchesCategory && !matchesEvidence) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && claim.category !== selectedCategory) {
        return false;
      }

      // Stance filter
      if (selectedStance !== 'ALL') {
        const hasStance = claim.evidence?.some((e) => {
          const s = e.stance?.toUpperCase();
          if (selectedStance === 'SUPPORT') return s === 'SUPPORT' || s === 'SUPPORTED';
          if (selectedStance === 'CONTRADICT') return s === 'CONTRADICT' || s === 'CONTRADICTED';
          if (selectedStance === 'NEUTRAL') return s !== 'SUPPORT' && s !== 'SUPPORTED' && s !== 'CONTRADICT' && s !== 'CONTRADICTED';
          return true;
        });
        if (!hasStance) return false;
      }

      return true;
    });
  }, [claims, searchTerm, selectedCategory, selectedStance]);

  const copyClaimText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Claim text copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <SearchCode className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Evidence Provenance Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Source-grounded claim ledger: inspect citations, supporting excerpts, independence groups, and stances.
          </p>
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Quote className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Extracted Claims</div>
            <div className="text-lg font-bold font-mono text-slate-100">{stats.totalClaims}</div>
          </div>
        </div>

        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Evidence Excerpts</div>
            <div className="text-lg font-bold font-mono text-slate-100">{stats.totalExcerpts}</div>
          </div>
        </div>

        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Supporting Citations</div>
            <div className="text-lg font-bold font-mono text-slate-100">{stats.supportCount}</div>
          </div>
        </div>

        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <XCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Contradictions</div>
            <div className="text-lg font-bold font-mono text-slate-100">{stats.contradictCount}</div>
          </div>
        </div>
      </div>

      {/* Toolbar / Search / Filters */}
      <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
              placeholder="Search claim text, citations, or domain..."
              className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50"
            />
          </form>

          {/* Stance Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px]">Stance:</span>
            <div className="flex items-center bg-[#0E1118] border border-[#1E2535] rounded-lg p-0.5">
              {(['ALL', 'SUPPORT', 'CONTRADICT', 'NEUTRAL'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStance(s)}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                    selectedStance === s
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Pills */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-thin">
            <span className="text-[11px] text-slate-400 uppercase font-mono mr-1">Category:</span>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-[#161B27] text-slate-400 hover:text-slate-300 border border-transparent'
              }`}
            >
              ALL ({claims.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-[#161B27] text-slate-400 hover:text-slate-300 border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Claims List and Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Claims ledger (lg:col-span-7 or 8) */}
        <div className={selectedClaim ? 'lg:col-span-7 space-y-3' : 'lg:col-span-12 space-y-3'}>
          {loading ? (
            <div className="space-y-3">
              <SkeletonCard rows={2} />
              <SkeletonCard rows={2} />
            </div>
          ) : filteredClaims.length > 0 ? (
            filteredClaims.map((claim) => {
              const isSelected = selectedClaim?.id === claim.id;
              const evCount = claim.evidence?.length || 0;

              return (
                <div
                  key={claim.id}
                  onClick={() => setSelectedClaim(isSelected ? null : claim)}
                  className={`bg-[#11151E] border rounded-xl p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-[#161B27]/60 shadow-lg shadow-indigo-950/20'
                      : 'border-[#1E2535] hover:border-slate-700 hover:bg-[#141924]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          {claim.category || 'Claim'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {evCount} {evCount === 1 ? 'citation' : 'citations'}
                        </span>
                        {claim.confidence !== null && claim.confidence !== undefined && (
                          <span className="text-[11px] font-mono text-emerald-400">
                            {Math.round(claim.confidence * 100)}% conf
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-medium text-slate-200 leading-relaxed">
                        "{claim.text}"
                      </p>

                      {/* Snippet of attached evidence stance */}
                      {evCount > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          {claim.evidence.slice(0, 3).map((ev, i) => (
                            <span
                              key={i}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${
                                ev.stance?.toUpperCase().includes('SUPPORT')
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : ev.stance?.toUpperCase().includes('CONTRADICT')
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-slate-700/30 text-slate-400 border border-slate-700/50'
                              }`}
                            >
                              {ev.stance}
                            </span>
                          ))}
                          {evCount > 3 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              +{evCount - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyClaimText(claim.text, claim.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1E2535] transition-colors"
                        title="Copy claim text"
                      >
                        {copiedId === claim.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={SearchCode}
              title="No Claims Found"
              description="No claims match your current filter query. Try resetting filters or search terms."
            />
          )}
        </div>

        {/* Right column: Inspector Drawer for selected claim (lg:col-span-5) */}
        {selectedClaim && (
          <div className="lg:col-span-5 bg-[#11151E] border border-indigo-500/40 rounded-xl p-5 space-y-4 shadow-2xl shadow-black/40 sticky top-20 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2535]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Claim Provenance Inspector
                </h3>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-[#1E2535]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Claim Box */}
            <div className="p-3.5 rounded-lg bg-[#0E1118] border border-[#1E2535] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-indigo-400 font-semibold">{selectedClaim.category || 'General Claim'}</span>
                {selectedClaim.confidence !== null && selectedClaim.confidence !== undefined && (
                  <span className="text-emerald-400">Score: {Math.round(selectedClaim.confidence * 100)}%</span>
                )}
              </div>
              <blockquote className="text-xs text-slate-100 font-medium italic leading-relaxed">
                "{selectedClaim.text}"
              </blockquote>
            </div>

            {/* Citations & Excerpts */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Attached Citations ({selectedClaim.evidence?.length || 0})</span>
              </div>

              {selectedClaim.evidence && selectedClaim.evidence.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {selectedClaim.evidence.map((ev, idx) => (
                    <div
                      key={ev.id || idx}
                      className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-semibold uppercase ${
                            ev.stance?.toUpperCase().includes('SUPPORT')
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : ev.stance?.toUpperCase().includes('CONTRADICT')
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-slate-700/30 text-slate-300'
                          }`}
                        >
                          {ev.stance}
                        </span>

                        {ev.source_url && (
                          <a
                            href={ev.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-mono text-[10px]"
                          >
                            <Globe className="w-2.5 h-2.5" />
                            <span>Source link</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>

                      <blockquote className="p-2.5 rounded bg-[#11151E] border-l-2 border-indigo-500/60 text-[11px] text-slate-300 italic leading-relaxed">
                        "{ev.excerpt}"
                      </blockquote>

                      {ev.quality_notes && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          <span className="text-slate-400">Quality: </span>
                          <span>{ev.quality_notes}</span>
                        </div>
                      )}

                      {ev.independence_group && (
                        <div className="text-[9px] font-mono text-slate-400">
                          Group: {ev.independence_group}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[#0E1118] border border-[#1E2535] text-center text-xs text-slate-400">
                  No verified excerpts attached to this claim.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

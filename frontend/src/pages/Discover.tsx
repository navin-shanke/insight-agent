import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Sparkles,
  Sliders,
  Clock,
  Coins,
  Search,
  Layers,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { submitResearch } from '../api/research';

export const Discover: React.FC = () => {
  const navigate = useNavigate();

  // Form states
  const [query, setQuery] = useState('');
  const [sourceBudget, setSourceBudget] = useState(25);
  const [maxIterations, setMaxIterations] = useState(3);
  const [timeBudgetMinutes, setTimeBudgetMinutes] = useState(10);
  const [tokenBudget, setTokenBudget] = useState(15000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const samplePrompts = [
    'Find emerging AI agent frameworks released in the past 6 months and compare their architecture.',
    'Investigate open-source local LLM quantization techniques and benchmark accuracy claims.',
    'Identify recent autonomous research tooling in biotechnology and evaluate their claim verification methods.',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const task = await submitResearch({
        query: query.trim(),
        source_budget: sourceBudget,
        max_iterations: maxIterations,
        time_budget_seconds: timeBudgetMinutes * 60,
        token_budget: tokenBudget,
      });

      // Navigate to Research Tasks view to track progress
      navigate(`/tasks?highlight=${task.task_id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to dispatch research task');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Compass className="w-5 h-5 text-indigo-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Research Prompt Composer
          </h1>
        </div>
        <p className="text-xs text-slate-400">
          Configure a bounded autonomous investigation. Set query depth, safety fences, and resource budgets.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Prompt Input Box */}
        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 space-y-3 shadow-lg shadow-black/20 focus-within:border-indigo-500/50 transition-colors">
          <div className="flex items-center justify-between text-xs font-medium text-slate-300">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Research Objective or Question</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {query.length} / 2000 chars
            </span>
          </div>

          <textarea
            required
            rows={4}
            maxLength={2000}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Find emerging AI automation startups in India, verify their products and identify recent funding or launch announcements."
            className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-3 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/60 leading-relaxed transition-colors resize-none"
          />

          {/* Prompt quick templates */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Preset Examples
            </span>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((p, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setQuery(p)}
                  className="text-left text-[11px] px-2.5 py-1 rounded-md bg-[#161B27] hover:bg-[#1E2538] text-slate-300 hover:text-indigo-300 border border-[#1E2535] transition-colors"
                >
                  {p.slice(0, 56)}...
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bounded Configuration Parameters */}
        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 pb-2 border-b border-[#1E2535]">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Operational Constraints & Resource Budgets</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Budget */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Max Sources to Inspect</span>
                </span>
                <span className="font-mono text-indigo-400 font-semibold">{sourceBudget} sources</span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={sourceBudget}
                onChange={(e) => setSourceBudget(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-[#161B27] rounded-lg"
              />
              <p className="text-[10px] text-slate-400">
                DuckDuckGo search queries and pages safely fetched and scraped.
              </p>
            </div>

            {/* Max Iterations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Research Iterations</span>
                </span>
                <span className="font-mono text-indigo-400 font-semibold">{maxIterations} loops</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-[#161B27] rounded-lg"
              />
              <p className="text-[10px] text-slate-400">
                Number of autonomous evaluation and follow-up query cycles.
              </p>
            </div>

            {/* Time Budget */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Execution Deadline</span>
                </span>
                <span className="font-mono text-indigo-400 font-semibold">{timeBudgetMinutes} minutes</span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                step={2}
                value={timeBudgetMinutes}
                onChange={(e) => setTimeBudgetMinutes(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-[#161B27] rounded-lg"
              />
              <p className="text-[10px] text-slate-400">
                Hard ceiling. Worker safely checkpoint-halts upon deadline.
              </p>
            </div>

            {/* Token Budget */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Coins className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Token Budget Cap</span>
                </span>
                <span className="font-mono text-indigo-400 font-semibold">
                  {tokenBudget.toLocaleString()} tokens
                </span>
              </div>
              <input
                type="range"
                min={2000}
                max={40000}
                step={2000}
                value={tokenBudget}
                onChange={(e) => setTokenBudget(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-[#161B27] rounded-lg"
              />
              <p className="text-[10px] text-slate-400">
                Stops LLM synthesis if reported Ollama context usage exceeds limit.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Launching Investigation...
              </span>
            ) : (
              <>
                <Compass className="w-4 h-4" />
                <span>Launch Autonomous Research</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

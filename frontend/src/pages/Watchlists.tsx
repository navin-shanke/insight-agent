import React, { useEffect, useState } from 'react';
import { Eye, Plus, Trash2, CheckCircle2, XCircle, Tag, Layers } from 'lucide-react';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { EmptyState } from '../design-system/components/EmptyState';
import { fetchWatchlists, createWatchlist, updateWatchlist, deleteWatchlist } from '../api/watchlists';
import { Watchlist } from '../types';

export const Watchlists: React.FC = () => {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);

  // New watchlist modal / form state
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchWatchlists();
      setWatchlists(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !topic.trim()) return;

    setSaving(true);
    try {
      await createWatchlist({
        name: name.trim(),
        topic: topic.trim(),
        keywords: keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        enabled: true,
      });
      setName('');
      setTopic('');
      setKeywords('');
      setShowAdd(false);
      await loadData();
    } catch (err) {
      alert('Failed to create watchlist');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (w: Watchlist) => {
    try {
      await updateWatchlist(w.id, { enabled: !w.enabled });
      await loadData();
    } catch {
      alert('Failed to update watchlist');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this watchlist?')) return;
    try {
      await deleteWatchlist(id);
      await loadData();
    } catch {
      alert('Failed to delete watchlist');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Eye className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Watchlists
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Define topics and keywords for recurring autonomous background discovery runs.
          </p>
        </div>

        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all self-start sm:self-auto shadow-md shadow-indigo-600/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Watchlist</span>
        </button>
      </div>

      {/* Add New Watchlist Card */}
      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="bg-[#11151E] border border-indigo-500/40 rounded-xl p-5 space-y-4 shadow-xl"
        >
          <h3 className="text-xs font-semibold text-slate-200">New Monitored Topic</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Watchlist Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI Startup Funding"
                className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Primary Search Topic
              </label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Indian AI startups seed funding 2026"
                className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Comma-Separated Keywords
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. venture, seed round, YC, robotics, foundation model"
              className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Watchlist'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : watchlists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {watchlists.map((w) => (
            <div
              key={w.id}
              className={`bg-[#11151E] border rounded-xl p-5 space-y-3 transition-all ${
                w.enabled ? 'border-[#1E2535]' : 'border-[#1E2535]/50 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-100">{w.name}</h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        w.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}
                    >
                      {w.enabled ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-400 font-mono">{w.topic}</p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(w)}
                    title={w.enabled ? 'Pause watchlist' : 'Activate watchlist'}
                    className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-[#161B27]"
                  >
                    {w.enabled ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(w.id)}
                    title="Delete watchlist"
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-[#161B27]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {w.keywords && w.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {w.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#161B27] text-slate-300 border border-[#1E2535]"
                    >
                      <Tag className="w-2.5 h-2.5 text-slate-400" />
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Eye}
          title="No Watchlists Configured"
          description="Create a watchlist to enable autonomous scheduled discovery to monitor topics automatically."
          action={{
            label: "Create First Watchlist",
            onClick: () => setShowAdd(true),
          }}
        />
      )}
    </div>
  );
};

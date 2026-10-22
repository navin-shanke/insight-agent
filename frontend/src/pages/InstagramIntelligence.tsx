import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Plus,
  Video,
  Layers,
  Image as ImageIcon,
  FlaskConical,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  MessageSquare,
  ThumbsUp,
  Eye,
  Hash,
  Scale,
  Brain,
  History,
  Compass,
  RotateCcw,
  Wrench,
  Code,
  ShieldAlert,
  Upload,
  FileSpreadsheet,
  FileText,
  Copy,
  Search,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { EmptyState } from '../design-system/components/EmptyState';
import {
  fetchInstagramObservations,
  fetchInstagramPatterns,
  fetchInstagramStrategy,
  fetchInstagramExperiments,
  fetchInstagramRecommendations,
  fetchInstagramStrategyHistory,
  rollbackInstagramStrategy,
  fetchSystemImprovementProposals,
  reviewSystemImprovementProposal,
  ingestInstagramObservation,
  submitInstagramFeedback,
  createInstagramExperiment,
  recordExperimentOutcome,
  previewBatchImport,
  commitBatchImport,
} from '../api/instagram';
import {
  BatchImportPreviewResponse,
  InstagramExperiment,
  InstagramObservation,
  InstagramPatternsResponse,
  InstagramRecommendation,
  InstagramStrategyProfile,
  InstagramStrategyVersionOut,
  SystemImprovementProposal,
} from '../types';

export const InstagramIntelligence: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'strategy' | 'experiments' | 'content' | 'patterns' | 'proposals'>('recommendations');

  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<InstagramStrategyProfile | null>(null);
  const [patterns, setPatterns] = useState<InstagramPatternsResponse | null>(null);
  const [experiments, setExperiments] = useState<InstagramExperiment[]>([]);
  const [observations, setObservations] = useState<InstagramObservation[]>([]);
  const [recommendations, setRecommendations] = useState<InstagramRecommendation[]>([]);
  const [strategyHistory, setStrategyHistory] = useState<InstagramStrategyVersionOut[]>([]);
  const [proposals, setProposals] = useState<SystemImprovementProposal[]>([]);

  // Batch Import Modal state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchPreview, setBatchPreview] = useState<BatchImportPreviewResponse | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchCommitting, setBatchCommitting] = useState(false);
  const [provenanceLabel, setProvenanceLabel] = useState('Batch file export');
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Ingest Modal state
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestForm, setIngestForm] = useState({
    source_url: '',
    account_handle: '',
    format: 'reel' as 'reel' | 'carousel' | 'image' | 'unknown',
    caption: '',
    hook: '',
    views: '',
    likes: '',
    comments: '',
    collection_method: 'user_url' as 'user_url' | 'manual_entry' | 'dataset_export',
    provenance_notes: 'User-provided post observation',
  });
  const [ingesting, setIngesting] = useState(false);

  // New Experiment Modal state
  const [showExpModal, setShowExpModal] = useState(false);
  const [expForm, setExpForm] = useState({
    title: '',
    proposed_change: '',
    evidence_rationale: '',
    why_it_helps: '',
    evaluation_metric: 'View completion & comment rate',
    sample_required: 3,
    baseline_summary: '',
  });

  // Outcome Modal state
  const [outcomeModal, setOutcomeModal] = useState<{ open: boolean; expId: string; title: string }>({
    open: false,
    expId: '',
    title: '',
  });
  const [outcomeText, setOutcomeText] = useState('');

  // Observed Content Ledger filters
  const [contentFormatFilter, setContentFormatFilter] = useState<'ALL' | 'reel' | 'carousel' | 'image'>('ALL');
  const [contentSearchQuery, setContentSearchQuery] = useState('');

  const loadAll = async () => {
    try {
      const [sRes, pRes, eRes, oRes, rRes, hRes, propRes] = await Promise.all([
        fetchInstagramStrategy(),
        fetchInstagramPatterns(),
        fetchInstagramExperiments(),
        fetchInstagramObservations(100),
        fetchInstagramRecommendations(),
        fetchInstagramStrategyHistory(),
        fetchSystemImprovementProposals(),
      ]);
      setStrategy(sRes);
      setPatterns(pRes);
      setExperiments(eRes);
      setObservations(oRes.items || []);
      setRecommendations(rRes || []);
      setStrategyHistory(hRes || []);
      setProposals(propRes || []);
    } catch (err) {
      toast.error('Failed to load Instagram learning data');
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendationAction = async (recId: string, action: 'accepted' | 'rejected') => {
    try {
      await submitInstagramFeedback({
        target_id: recId,
        target_type: 'recommendation',
        action,
        user_note: `User explicitly ${action} recommendation`,
      });
      toast.success(`Recommendation ${action}`);
      await loadAll();
    } catch {
      toast.error('Failed to update recommendation status');
    }
  };

  const handleRollback = async (ver: number) => {
    if (!window.confirm(`Are you sure you want to revert strategy profile to Version ${ver}?`)) return;
    try {
      await rollbackInstagramStrategy(ver);
      toast.success(`Rolled back to strategy Version ${ver}`);
      await loadAll();
    } catch {
      toast.error('Failed to rollback strategy');
    }
  };

  const handleReviewProposalAction = async (propId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      await reviewSystemImprovementProposal(propId, {
        action,
        review_notes: `User explicitly ${action.toLowerCase()} candidate improvement`,
      });
      toast.success(`Proposal ${action}`);
      await loadAll();
    } catch {
      toast.error('Failed to review proposal');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBatchFile(file);
    setBatchLoading(true);
    setProvenanceLabel(`Import from ${file.name}`);
    try {
      const preview = await previewBatchImport(file);
      setBatchPreview(preview);
      if (preview.valid_count === 0 && preview.total_rows > 0) {
        toast.error('No valid rows found in file. Check format and required fields.');
      } else {
        toast.success(`Parsed ${preview.total_rows} rows (${preview.valid_count} valid, ${preview.duplicate_count} duplicate)`);
      }
    } catch {
      toast.error('Failed to parse file. Ensure it is a valid CSV or JSON file.');
      setBatchPreview(null);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCommitBatch = async () => {
    if (!batchPreview || batchPreview.valid_count === 0) return;
    setBatchCommitting(true);
    try {
      const validItems = batchPreview.items
        .filter((item) => item.status === 'valid' && item.parsed_observation)
        .map((item) => item.parsed_observation);

      const res = await commitBatchImport({
        items: validItems,
        provenance_label: provenanceLabel.trim() || 'Batch dataset import',
        skip_duplicates: skipDuplicates,
      });

      toast.success(res.message);
      setShowBatchModal(false);
      setBatchFile(null);
      setBatchPreview(null);
      await loadAll();
    } catch {
      toast.error('Failed to commit batch import');
    } finally {
      setBatchCommitting(false);
    }
  };

  const copyCsvTemplate = () => {
    const template = 'url,creator,type,caption,likes,views,comments,saves\nhttps://www.instagram.com/reel/example1,@creator,reel,5 developer mistakes to avoid in 2026,450,12000,35,180\nhttps://www.instagram.com/p/example2,@creator,carousel,Architecture patterns comparison,300,,15,\n';
    navigator.clipboard.writeText(template);
    toast.success('Example CSV template copied to clipboard');
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestForm.source_url || !ingestForm.caption) {
      toast.error('Please enter a source URL and caption');
      return;
    }

    setIngesting(true);
    try {
      const metrics = {
        views: ingestForm.views ? parseInt(ingestForm.views, 10) : null,
        likes: ingestForm.likes ? parseInt(ingestForm.likes, 10) : null,
        comments: ingestForm.comments ? parseInt(ingestForm.comments, 10) : null,
      };

      await ingestInstagramObservation({
        source_url: ingestForm.source_url,
        account_handle: ingestForm.account_handle ? (ingestForm.account_handle.startsWith('@') ? ingestForm.account_handle : `@${ingestForm.account_handle}`) : undefined,
        format: ingestForm.format,
        caption: ingestForm.caption,
        hook: ingestForm.hook || undefined,
        metrics,
        collection_method: ingestForm.collection_method,
        provenance_notes: ingestForm.provenance_notes || undefined,
      });

      toast.success('Observation ingested and patterns adapted');
      setShowIngestModal(false);
      setIngestForm({
        source_url: '',
        account_handle: '',
        format: 'reel',
        caption: '',
        hook: '',
        views: '',
        likes: '',
        comments: '',
        collection_method: 'user_url',
        provenance_notes: 'User-provided post observation',
      });
      await loadAll();
    } catch (err) {
      toast.error('Failed to ingest observation');
    } finally {
      setIngesting(false);
    }
  };

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expForm.title || !expForm.proposed_change) {
      toast.error('Please complete the title and proposed change');
      return;
    }
    try {
      await createInstagramExperiment(expForm);
      toast.success('Experiment proposed');
      setShowExpModal(false);
      setExpForm({
        title: '',
        proposed_change: '',
        evidence_rationale: '',
        why_it_helps: '',
        evaluation_metric: 'View completion & comment rate',
        sample_required: 3,
        baseline_summary: '',
      });
      await loadAll();
    } catch (err) {
      toast.error('Failed to propose experiment');
    }
  };

  const handleFeedback = async (
    targetId: string,
    targetType: 'pattern' | 'experiment' | 'recommendation',
    action: 'accepted' | 'rejected' | 'modified',
    note?: string
  ) => {
    try {
      await submitInstagramFeedback({
        target_id: targetId,
        target_type: targetType,
        action,
        user_note: note,
      });
      toast.success(`Strategy updated: ${action} ${targetType}`);
      await loadAll();
    } catch (err) {
      toast.error('Failed to save feedback');
    }
  };

  const handleRecordOutcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeText.trim()) return;
    try {
      await recordExperimentOutcome(outcomeModal.expId, outcomeText.trim(), 'completed');
      toast.success('Experiment outcome recorded');
      setOutcomeModal({ open: false, expId: '', title: '' });
      setOutcomeText('');
      await loadAll();
    } catch (err) {
      toast.error('Failed to record outcome');
    }
  };

  if (loading) {
    return <SkeletonCard rows={8} />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Instagram Intelligence & Adaptive Learning
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Evidence-grounded pattern extraction, persistent strategy profiles, and controlled experiment evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-200 border border-[#1E2535] transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import CSV / JSON</span>
          </button>
          <button
            onClick={() => setShowIngestModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ingest Post</span>
          </button>
          <button
            onClick={loadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535]">
          <span className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
            Observed Posts
          </span>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            {strategy?.sample_size || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">With full provenance & timestamp</p>
        </div>

        <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535]">
          <span className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
            Promising Patterns
          </span>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {strategy?.promising_patterns.length || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Verified across sample size</p>
        </div>

        <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535]">
          <span className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
            Active Experiments
          </span>
          <div className="text-2xl font-bold text-indigo-400 font-mono">
            {experiments.filter((e) => e.status === 'active' || e.status === 'proposed').length}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Controlled test proposals</p>
        </div>

        <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535]">
          <span className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
            User Feedback Adjustments
          </span>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {strategy?.user_feedback.length || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Accepted or rejected learnings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#1E2535] text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'recommendations'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Strategic Recommendations</span>
          {recommendations.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
              {recommendations.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('strategy')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'strategy'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Strategy Profile & History</span>
        </button>

        <button
          onClick={() => setActiveTab('experiments')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'experiments'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Experiment Lab</span>
          {experiments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#161B27] text-[10px] text-slate-300 font-mono">
              {experiments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'content'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Observed Content Ledger</span>
          {observations.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#161B27] text-[10px] text-slate-300 font-mono">
              {observations.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('patterns')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'patterns'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Pattern Analysis</span>
        </button>

        <button
          onClick={() => setActiveTab('proposals')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'proposals'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Self-Improvement (Level B)</span>
          {proposals.filter((p) => p.status === 'PENDING_REVIEW').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
              {proposals.filter((p) => p.status === 'PENDING_REVIEW').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Strategic Recommendations (7-Point Explanations) */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-400" />
                <span>Prioritized Content Recommendations</span>
              </h2>
              <p className="text-xs text-slate-400">
                Actionable content recommendations structured with explicit evidence, confidence thresholds, and contingency workflows.
              </p>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Evidence-calibrated</span>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <EmptyState
              title="No recommendations generated yet"
              description="Ingest post observations to populate evidence-based recommendations."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {recommendations.map((rec) => {
                const priorityColors = {
                  high: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
                  medium: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                  low: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
                };
                const catLabels: Record<string, string> = {
                  data_gap: 'Data Gap / Benchmark',
                  format_choice: 'Format Selection',
                  opening_hook: 'Hook Architecture',
                  underperforming_pattern: 'Friction Elimination',
                  content_theme: 'Content Theme',
                  posting_window: 'Posting Window',
                };

                return (
                  <div
                    key={rec.id}
                    className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-4 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2535] pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase border ${priorityColors[rec.priority]}`}
                          >
                            {rec.priority} Priority
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#161B27] text-slate-300 border border-[#1E2535]">
                            {catLabels[rec.category] || rec.category}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Sample N={rec.evidence_sample_size}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-100">{rec.title}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setExpForm({
                              title: `Test: ${rec.title}`,
                              proposed_change: rec.what_to_do,
                              evidence_rationale: rec.supporting_evidence,
                              why_it_helps: rec.why_recommended,
                              evaluation_metric: rec.measurement_plan || 'Save and comment rate',
                              sample_required: Math.max(3, rec.evidence_sample_size || 3),
                              baseline_summary: `Current benchmark across N=${rec.evidence_sample_size} observed posts`,
                            });
                            setShowExpModal(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors"
                          title="Propose a controlled experiment testing this recommendation"
                        >
                          <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Create Experiment</span>
                        </button>
                        <button
                          onClick={() => handleRecommendationAction(rec.id, 'accepted')}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => handleRecommendationAction(rec.id, 'rejected')}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>

                    {/* 7-Point Breakdown Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]/60 space-y-1">
                        <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block">
                          1. Action Plan (What to do)
                        </span>
                        <p className="text-slate-200 leading-relaxed">{rec.what_to_do}</p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]/60 space-y-1">
                        <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider block">
                          2. Rationale (Why it is recommended)
                        </span>
                        <p className="text-slate-300 leading-relaxed">{rec.why_recommended}</p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]/60 space-y-1">
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">
                          3. Supporting Evidence
                        </span>
                        <p className="text-slate-300 leading-relaxed">{rec.supporting_evidence}</p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]/60 space-y-1">
                        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">
                          4. Confidence & Caveats
                        </span>
                        <p className="text-slate-300 leading-relaxed">{rec.confidence_and_limitations}</p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]/60 space-y-1">
                        <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider block">
                          5. Expected Outcome
                        </span>
                        <p className="text-slate-300 leading-relaxed">{rec.expected_outcome}</p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]/60 space-y-1">
                        <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider block">
                          6. Measurement Plan
                        </span>
                        <p className="text-slate-300 leading-relaxed">{rec.measurement_plan}</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]/60 space-y-1 text-xs">
                      <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider block">
                        7. Contingency Plan (Next action if outcome fails)
                      </span>
                      <p className="text-slate-300 leading-relaxed">{rec.contingency_plan}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Strategy & Hypotheses */}
      {activeTab === 'strategy' && (
        <div className="space-y-6">
          {/* Promising Patterns Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Promising Content Patterns</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Patterns backed by observed sample sizes and measured outcome trends.
                </p>
              </div>
            </div>

            {strategy && strategy.promising_patterns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategy.promising_patterns.map((pat) => (
                  <div
                    key={pat.id}
                    className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-[#2A3449] transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Confidence: {pat.confidence}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Sample: {pat.sample_size} posts
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-100">{pat.pattern_title}</h3>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {pat.description}
                    </p>

                    <div className="p-2.5 rounded-lg bg-[#0E1118] border border-[#1E2535] text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span>Measured Outcome:</span>
                        <span className="font-semibold text-slate-200">{pat.measured_outcome}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        <span className="font-semibold">Caveat:</span> {pat.limitations}
                      </div>
                    </div>

                    {/* User Feedback Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#1E2535]/60 text-xs">
                      <span className="text-[10px] text-slate-500 mr-auto">User alignment:</span>
                      <button
                        onClick={() => handleFeedback(pat.id, 'pattern', 'accepted')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#161B27] hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-300 border border-[#1E2535] transition-colors text-[11px]"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleFeedback(pat.id, 'pattern', 'rejected')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#161B27] hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 border border-[#1E2535] transition-colors text-[11px]"
                      >
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-[#11151E] border border-[#1E2535] text-slate-400 text-xs">
                No promising patterns identified yet. Ingest 2 or more posts to establish initial patterns.
              </div>
            )}
          </div>

          {/* Tested Hypotheses */}
          <div className="space-y-3 pt-2">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-400" />
              <span>Tested Hypotheses & Evidence</span>
            </h2>

            {strategy && strategy.tested_hypotheses.length > 0 ? (
              <div className="divide-y divide-[#1E2535] rounded-xl border border-[#1E2535] bg-[#11151E] overflow-hidden">
                {strategy.tested_hypotheses.map((hyp) => {
                  let statusBadge = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                  if (hyp.status === 'supported') {
                    statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  } else if (hyp.status === 'testing') {
                    statusBadge = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                  } else if (hyp.status === 'refuted') {
                    statusBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  }

                  return (
                    <div key={hyp.id} className="p-4 sm:p-5 space-y-2 hover:bg-[#161B27]/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${statusBadge}`}>
                          {hyp.status}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          Sample: {hyp.sample_size} posts
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-200">
                        {hyp.hypothesis}
                      </p>

                      <p className="text-xs text-slate-400 bg-[#0E1118] p-2 rounded-lg border border-[#1E2535]">
                        <span className="font-semibold text-slate-500 text-[10px] uppercase block mb-0.5">
                          Evidence Notes
                        </span>
                        {hyp.evidence_notes}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* User Feedback History */}
          {strategy && strategy.user_feedback.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <span>User Correction & Alignment Log</span>
              </h2>

              <div className="divide-y divide-[#1E2535] rounded-xl border border-[#1E2535] bg-[#11151E] overflow-hidden text-xs">
                {strategy.user_feedback.map((fb) => (
                  <div key={fb.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            fb.action === 'accepted'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : fb.action === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {fb.action}
                        </span>
                        <span className="text-slate-300 font-mono text-[11px]">
                          Target: {fb.target_id} ({fb.target_type})
                        </span>
                      </div>
                      {fb.user_note && <p className="text-slate-400 text-[11px]">{fb.user_note}</p>}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(fb.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategy Version History & Audit Trail */}
          <div className="space-y-3 pt-4 border-t border-[#1E2535]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  <span>Strategy Profile Version History & Audit Trail</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Every observation ingestion, feedback submission, and experiment outcome creates an immutable version checkpoint.
                </p>
              </div>
            </div>

            {strategyHistory.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No historical checkpoints recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {strategyHistory.map((item) => (
                  <div
                    key={item.version}
                    className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535] flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/20 text-indigo-300 text-[11px] border border-indigo-500/30">
                        v{item.version}
                      </span>
                      <div>
                        <div className="font-medium text-slate-200">{item.change_summary}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Trigger: {item.change_trigger}</span>
                          <span>•</span>
                          <span>Sample size: {item.sample_size}</span>
                          <span>•</span>
                          <span>{new Date(item.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRollback(item.version)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-[#161B27] hover:bg-[#1E2535] text-slate-300 border border-[#1E2535] transition-colors"
                      title="Rollback strategy profile to this checkpoint"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span>Revert</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Experiment Lab */}
      {activeTab === 'experiments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-indigo-400" />
                <span>Explainable Experiment Proposals</span>
              </h2>
              <p className="text-xs text-slate-400">
                Controlled tests to evaluate content strategies against measurable baselines.
              </p>
            </div>

            <button
              onClick={() => setShowExpModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Propose New Experiment</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {experiments.map((exp) => (
              <div
                key={exp.id}
                className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] hover:border-[#2A3449] transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        exp.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : exp.status === 'active'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : exp.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {exp.status}
                    </span>

                    <span className="text-[11px] font-mono text-slate-400">
                      Sample Target: {exp.sample_required} posts
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 leading-snug">{exp.title}</h3>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#0E1118] border border-[#1E2535] space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Proposed Change
                      </span>
                      <p className="text-slate-200">{exp.proposed_change}</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#0E1118] border border-[#1E2535] space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Evidence Rationale & Mechanism
                      </span>
                      <p className="text-slate-300">{exp.evidence_rationale}</p>
                      <p className="text-indigo-400 font-sans text-[11px] pt-1">
                        Why it may help: {exp.why_it_helps}
                      </p>
                    </div>

                    <div className="p-2 rounded bg-[#0E1118] text-[11px] flex items-center justify-between text-slate-400 border border-[#1E2535]">
                      <span>Evaluation Metric:</span>
                      <span className="text-slate-200 font-semibold">{exp.evaluation_metric}</span>
                    </div>

                    {exp.baseline_summary && (
                      <div className="text-[11px] text-slate-400">
                        <span className="text-slate-500 font-semibold">Baseline:</span> {exp.baseline_summary}
                      </div>
                    )}

                    {exp.outcome_summary && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                        <span className="font-semibold block text-[10px] uppercase mb-0.5">
                          Measured Outcome
                        </span>
                        {exp.outcome_summary}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E2535] text-xs">
                  {exp.status === 'proposed' && (
                    <>
                      <button
                        onClick={() => handleFeedback(exp.id, 'experiment', 'accepted')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px]"
                      >
                        Accept & Activate
                      </button>
                      <button
                        onClick={() => handleFeedback(exp.id, 'experiment', 'rejected')}
                        className="px-3 py-1.5 rounded-lg bg-[#161B27] hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-[#1E2535] font-medium text-[11px]"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {exp.status === 'active' && (
                    <button
                      onClick={() => setOutcomeModal({ open: true, expId: exp.id, title: exp.title })}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px]"
                    >
                      Record Measured Outcome
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Observed Content Ledger */}
      {activeTab === 'content' && (() => {
        const totalObs = observations.length;
        const withLikes = observations.filter((o) => o.metrics?.likes !== null && o.metrics?.likes !== undefined).length;
        const withViews = observations.filter((o) => o.metrics?.views !== null && o.metrics?.views !== undefined).length;
        const withComments = observations.filter((o) => o.metrics?.comments !== null && o.metrics?.comments !== undefined).length;

        const filteredObs = observations.filter((obs) => {
          if (contentFormatFilter !== 'ALL' && obs.format !== contentFormatFilter) return false;
          if (contentSearchQuery.trim()) {
            const q = contentSearchQuery.toLowerCase();
            const inCaption = (obs.caption || '').toLowerCase().includes(q);
            const inHook = (obs.hook || '').toLowerCase().includes(q);
            const inHandle = (obs.account_handle || '').toLowerCase().includes(q);
            const inTags = (obs.hashtags || []).some((t) => t.toLowerCase().includes(q));
            if (!inCaption && !inHook && !inHandle && !inTags) return false;
          }
          return true;
        });

        return (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-slate-200 block">Observed Instagram Posts & Provenance</span>
                <span className="text-slate-400 text-[11px]">
                  {observations.length} items collected via permitted user URLs and exports. Missing metrics strictly remain null.
                </span>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161B27] hover:bg-[#1E2535] text-slate-200 border border-[#1E2535] text-xs font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Import CSV / JSON</span>
                </button>
                <button
                  onClick={() => setShowIngestModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ingest Single Post</span>
                </button>
              </div>
            </div>

            {/* Metric Data Coverage Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#0E1118] border border-[#1E2535] text-xs">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Observed</span>
                <span className="text-lg font-bold text-slate-200 font-mono">{totalObs} posts</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0E1118] border border-[#1E2535] text-xs">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Likes Recorded</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {withLikes} <span className="text-xs font-normal text-slate-400">({totalObs ? Math.round((withLikes / totalObs) * 100) : 0}%)</span>
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#0E1118] border border-[#1E2535] text-xs">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Views Recorded</span>
                <span className="text-lg font-bold text-indigo-400 font-mono">
                  {withViews} <span className="text-xs font-normal text-slate-400">({totalObs ? Math.round((withViews / totalObs) * 100) : 0}%)</span>
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#0E1118] border border-[#1E2535] text-xs">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Comments Recorded</span>
                <span className="text-lg font-bold text-amber-400 font-mono">
                  {withComments} <span className="text-xs font-normal text-slate-400">({totalObs ? Math.round((withComments / totalObs) * 100) : 0}%)</span>
                </span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3.5 rounded-xl bg-[#11151E] border border-[#1E2535] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 text-[10px] uppercase font-semibold mr-1">Format:</span>
                {(['ALL', 'reel', 'carousel', 'image'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setContentFormatFilter(fmt)}
                    className={`px-2.5 py-1 rounded-lg font-medium capitalize text-xs transition-colors ${
                      contentFormatFilter === fmt
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#0E1118] text-slate-400 hover:text-slate-200 border border-[#1E2535]'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={contentSearchQuery}
                  onChange={(e) => setContentSearchQuery(e.target.value)}
                  placeholder="Search caption, hook, or handle..."
                  className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {filteredObs.length > 0 ? (
              <div className="divide-y divide-[#1E2535] rounded-xl border border-[#1E2535] bg-[#11151E] overflow-hidden">
                {filteredObs.map((obs) => (
                  <div key={obs.id} className="p-4 sm:p-5 space-y-3 hover:bg-[#161B27]/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {obs.format}
                          </span>

                          {obs.account_handle && (
                            <span className="text-xs font-semibold text-slate-200">
                              {obs.account_handle}
                            </span>
                          )}

                          <span className="text-[11px] text-slate-500 font-mono">
                            Method: {obs.collection_method}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 font-medium">
                          <span className="text-slate-500 uppercase text-[10px] font-semibold mr-1">Hook:</span>
                          &ldquo;{obs.hook}&rdquo;
                        </div>
                      </div>

                      <a
                        href={obs.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded bg-[#161B27] border border-[#1E2535] flex-shrink-0"
                      >
                        <span>Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {obs.caption}
                    </p>

                    {/* Metrics bar */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1 border-t border-[#1E2535]/60 font-mono">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-slate-500" />
                        <span>{obs.metrics?.views !== null && obs.metrics?.views !== undefined ? obs.metrics.views.toLocaleString() : '— Not reported'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-slate-500" />
                        <span>{obs.metrics?.likes !== null && obs.metrics?.likes !== undefined ? obs.metrics.likes.toLocaleString() : '— Not reported'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-slate-500" />
                        <span>{obs.metrics?.comments !== null && obs.metrics?.comments !== undefined ? obs.metrics.comments.toLocaleString() : '— Not reported'}</span>
                      </span>
                      <span className="ml-auto text-[10px] text-slate-500">
                        Observed: {new Date(obs.observed_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-[#11151E] border border-[#1E2535] text-slate-400 text-xs space-y-2">
                <p>No Instagram posts match the current filter criteria.</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab 4: Pattern & Format Analysis */}
      {activeTab === 'patterns' && (() => {
        const formatChartData = (patterns?.formats || []).map((f) => ({
          format: f.format.toUpperCase(),
          count: f.count,
          avgLikes: f.avg_likes || 0,
        }));

        const hookChartData = (patterns?.hook_types || []).map((h) => ({
          name: h.hook_type.replace('_', ' '),
          count: h.count,
        }));

        const hashtagChartData = (patterns?.top_hashtags || []).slice(0, 8).map((h) => ({
          tag: `#${h.tag}`,
          count: h.count,
        }));

        return (
          <div className="space-y-6">
            {patterns?.disclaimer && (
              <div className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] text-xs text-slate-400 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p>{patterns.disclaimer}</p>
              </div>
            )}

            {/* Visual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Chart 1: Format Distribution */}
              <div className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Content Format Frequency</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    {patterns?.total_observations || 0} observations
                  </span>
                </div>
                {formatChartData.length > 0 ? (
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formatChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <XAxis dataKey="format" stroke="#64748B" fontSize={11} />
                        <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#0E1118', borderColor: '#1E2535', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#E2E8F0' }}
                        />
                        <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                    No format data recorded yet.
                  </div>
                )}
              </div>

              {/* Chart 2: Hook Styles */}
              <div className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Opening Hook Style Breakdown</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    {hookChartData.length} style types
                  </span>
                </div>
                {hookChartData.length > 0 ? (
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hookChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <XAxis dataKey="name" stroke="#64748B" fontSize={10} interval={0} />
                        <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#0E1118', borderColor: '#1E2535', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#E2E8F0' }}
                        />
                        <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                    No hook data recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Formats Grid */}
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-100">Content Format Performance Cards</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {patterns?.formats.map((fmt) => (
                  <div key={fmt.format} className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
                      <span className="capitalize">{fmt.format}</span>
                      <span className="font-mono text-indigo-400">{fmt.percentage}%</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-100 font-mono">
                      {fmt.count}
                    </div>
                    <div className="text-[10px] text-slate-500 space-y-0.5 pt-1 border-t border-[#1E2535]">
                      <div>Avg Views: {fmt.avg_views !== null && fmt.avg_views !== undefined ? fmt.avg_views.toLocaleString() : 'N/A (unreported)'}</div>
                      <div>Avg Likes: {fmt.avg_likes !== null && fmt.avg_likes !== undefined ? fmt.avg_likes.toLocaleString() : 'N/A (unreported)'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hook Styles */}
            <div className="space-y-3 pt-2">
              <h2 className="text-base font-bold text-slate-100">Opening Hook Styles & Examples</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {patterns?.hook_types.map((ht) => (
                  <div key={ht.hook_type} className="p-4 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="capitalize text-slate-200">{ht.hook_type.replace('_', ' ')}</span>
                      <span className="font-mono text-indigo-400">{ht.count} posts</span>
                    </div>
                    {ht.sample_examples.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {ht.sample_examples.map((ex, i) => (
                          <p key={i} className="text-[11px] text-slate-400 italic truncate bg-[#0E1118] p-1.5 rounded">
                            &ldquo;{ex}&rdquo;
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Hashtags */}
            {patterns?.top_hashtags && patterns.top_hashtags.length > 0 && (
              <div className="space-y-3 pt-2">
                <h2 className="text-base font-bold text-slate-100">Top Observed Hashtags</h2>
                <div className="flex flex-wrap gap-2">
                  {patterns.top_hashtags.map((h) => (
                    <span
                      key={h.tag}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#11151E] border border-[#1E2535] text-xs font-mono text-slate-300"
                    >
                      <Hash className="w-3 h-3 text-indigo-400" />
                      <span>#{h.tag}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">({h.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab: Self-Improvement Proposals (Level B) */}
      {activeTab === 'proposals' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                <span>Level B: Self-Improvement & Diagnostic Proposals</span>
              </h2>
              <p className="text-xs text-slate-400">
                The agent diagnoses recurring bottlenecks, missing indexes, and timeout risks, proposing reviewable patches.
                Changes require explicit user approval before application.
              </p>
            </div>
            <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs border border-amber-500/30 flex items-center gap-1.5 font-medium">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Approval Required</span>
            </div>
          </div>

          {proposals.length === 0 ? (
            <EmptyState
              title="No improvement proposals pending"
              description="System diagnostics report optimal operating state."
            />
          ) : (
            <div className="space-y-4">
              {proposals.map((prop) => (
                <div
                  key={prop.id}
                  className="p-5 rounded-xl bg-[#11151E] border border-[#1E2535] space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E2535] pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            prop.status === 'PENDING_REVIEW'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : prop.status === 'APPROVED' || prop.status === 'APPLIED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {prop.status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#161B27] text-slate-300 border border-[#1E2535]">
                          Component: {prop.component}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#161B27] text-slate-400 border border-[#1E2535]">
                          Risk: {prop.risk_level.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-100">{prop.title}</h3>
                    </div>

                    {prop.status === 'PENDING_REVIEW' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReviewProposalAction(prop.id, 'APPROVED')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Apply</span>
                        </button>
                        <button
                          onClick={() => handleReviewProposalAction(prop.id, 'REJECTED')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-300 block mb-1">Root Cause Analysis:</span>
                      <p className="text-slate-400 leading-relaxed">{prop.root_cause_analysis}</p>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-300 block mb-1">Verification Command:</span>
                      <pre className="p-2.5 rounded-lg bg-[#0E1118] border border-[#1E2535] text-cyan-300 font-mono text-[11px] overflow-x-auto">
                        {prop.verification_plan}
                      </pre>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-300 block mb-1">Candidate Patch (Diff):</span>
                      <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto">
                        {prop.candidate_patch_diff}
                      </pre>
                    </div>

                    {prop.reviewed_at && (
                      <div className="p-2.5 rounded-lg bg-[#161B27] border border-[#1E2535] text-[11px] text-slate-400">
                        Reviewed at: {new Date(prop.reviewed_at).toLocaleString()} • Notes: {prop.review_notes || 'None'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Batch CSV / JSON Import */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11151E] border border-[#1E2535] rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1E2535] pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">Batch Import Historical Posts (CSV / JSON)</h3>
              </div>
              <button
                onClick={() => {
                  setShowBatchModal(false);
                  setBatchPreview(null);
                  setBatchFile(null);
                }}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* File Dropzone & Instructions */}
              <div className="p-4 rounded-xl border-2 border-dashed border-[#1E2535] hover:border-indigo-500/50 bg-[#0E1118] text-center space-y-2 transition-colors">
                <div className="flex justify-center gap-3 text-slate-400">
                  <FileSpreadsheet className="w-8 h-8 text-indigo-400" />
                  <FileText className="w-8 h-8 text-cyan-400" />
                </div>
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20">
                    <span>Select CSV or JSON File</span>
                    <input
                      type="file"
                      accept=".csv,.json,text/csv,application/json"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={batchLoading}
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {batchFile ? `Selected: ${batchFile.name}` : 'Upload post archives or analytics exports'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#1E2535]/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Supported headers: url, caption, format, likes, views, comments, saves</span>
                  <button
                    type="button"
                    onClick={copyCsvTemplate}
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy CSV Template</span>
                  </button>
                </div>
              </div>

              {batchLoading && (
                <div className="p-6 text-center text-slate-400 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-400" />
                  <p>Parsing and validating records against database...</p>
                </div>
              )}

              {/* Preview Section */}
              {batchPreview && !batchLoading && (
                <div className="space-y-4 pt-1">
                  {/* Summary Counters */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-lg bg-[#161B27] border border-[#1E2535]">
                      <span className="text-[10px] text-slate-400 block uppercase">Total Rows</span>
                      <span className="text-base font-bold text-slate-100 font-mono">{batchPreview.total_rows}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] text-emerald-400 block uppercase">Valid</span>
                      <span className="text-base font-bold text-emerald-300 font-mono">{batchPreview.valid_count}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <span className="text-[10px] text-amber-400 block uppercase">Duplicates</span>
                      <span className="text-base font-bold text-amber-300 font-mono">{batchPreview.duplicate_count}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <span className="text-[10px] text-rose-400 block uppercase">Invalid</span>
                      <span className="text-base font-bold text-rose-300 font-mono">{batchPreview.invalid_count}</span>
                    </div>
                  </div>

                  {/* Settings & Provenance */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
                    <div className="space-y-1">
                      <label className="text-slate-300 font-medium block text-[11px]">Provenance Label</label>
                      <input
                        type="text"
                        value={provenanceLabel}
                        onChange={(e) => setProvenanceLabel(e.target.value)}
                        placeholder="e.g. Creator Q3 Archive"
                        className="w-full bg-[#161B27] border border-[#1E2535] rounded p-1.5 text-slate-200 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="skip_dups"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded border-[#1E2535] bg-[#161B27] text-indigo-500 focus:ring-0"
                      />
                      <label htmlFor="skip_dups" className="text-slate-300 text-xs select-none">
                        Skip duplicate records automatically
                      </label>
                    </div>
                  </div>

                  {/* Table of Parsed Records */}
                  <div className="space-y-2">
                    <span className="font-semibold text-slate-200 block text-xs">Parsed Records Preview</span>
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-[#1E2535] divide-y divide-[#1E2535] bg-[#0E1118]">
                      {batchPreview.items.map((item) => (
                        <div key={item.row_index} className="p-2.5 text-[11px] flex items-start justify-between gap-3 hover:bg-[#161B27]/40">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-500 text-[10px]">#{item.row_index}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                  item.status === 'valid'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : item.status === 'duplicate'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {item.status}
                              </span>
                              <span className="font-mono text-slate-300 truncate max-w-xs">{item.source_url || 'No URL'}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#161B27] text-slate-400 uppercase">{item.format}</span>
                            </div>
                            <p className="text-slate-400 truncate max-w-md">{item.caption_preview || 'No caption'}</p>
                            {item.reasons.length > 0 && (
                              <p className="text-amber-400/90 text-[10px]">{item.reasons.join(', ')}</p>
                            )}
                          </div>

                          <div className="text-right text-[10px] text-slate-400 font-mono whitespace-nowrap">
                            {item.metrics ? (
                              <div>
                                <span>Likes: {item.metrics.likes ?? '—'}</span>
                                {item.metrics.views !== undefined && <span> • Views: {item.metrics.views ?? '—'}</span>}
                              </div>
                            ) : (
                              <span>Metrics: —</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[#1E2535] pt-3 flex-shrink-0 text-xs">
              <span className="text-slate-400 text-[11px]">
                {batchPreview ? `${batchPreview.valid_count} posts ready for ingestion` : 'Select a file to begin'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBatchModal(false);
                    setBatchPreview(null);
                    setBatchFile(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#161B27] hover:bg-[#1E2535] text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!batchPreview || batchPreview.valid_count === 0 || batchCommitting}
                  onClick={handleCommitBatch}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-all shadow-md shadow-emerald-600/20"
                >
                  {batchCommitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Commit Import ({batchPreview?.valid_count || 0} Posts)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ingest Post Observation */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11151E] border border-[#1E2535] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E2535] pb-3">
              <h3 className="text-base font-bold text-slate-100">Ingest Instagram Observation</h3>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIngestSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Source URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://www.instagram.com/reel/..."
                  value={ingestForm.source_url}
                  onChange={(e) => setIngestForm({ ...ingestForm, source_url: e.target.value })}
                  className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs font-mono focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">Creator Handle</label>
                  <input
                    type="text"
                    placeholder="@creator"
                    value={ingestForm.account_handle}
                    onChange={(e) => setIngestForm({ ...ingestForm, account_handle: e.target.value })}
                    className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs font-mono focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">Format</label>
                  <select
                    value={ingestForm.format}
                    onChange={(e: any) => setIngestForm({ ...ingestForm, format: e.target.value })}
                    className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs focus:border-indigo-500 outline-none"
                  >
                    <option value="reel">Reel (Short Video)</option>
                    <option value="carousel">Carousel (Multi-slide)</option>
                    <option value="image">Single Image</option>
                    <option value="unknown">Other / Unknown</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Caption Text *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Paste the post caption..."
                  value={ingestForm.caption}
                  onChange={(e) => setIngestForm({ ...ingestForm, caption: e.target.value })}
                  className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">
                  Opening Hook <span className="text-slate-500 font-normal">(Optional, auto-extracted if blank)</span>
                </label>
                <input
                  type="text"
                  placeholder="The first line or opening prompt..."
                  value={ingestForm.hook}
                  onChange={(e) => setIngestForm({ ...ingestForm, hook: e.target.value })}
                  className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Observed Metrics (Optional) */}
              <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535] space-y-2">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  Observed Metrics (Leave blank if unavailable — never guessed)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="Views"
                    value={ingestForm.views}
                    onChange={(e) => setIngestForm({ ...ingestForm, views: e.target.value })}
                    className="bg-[#161B27] border border-[#1E2535] rounded p-2 text-slate-200 text-xs font-mono outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Likes"
                    value={ingestForm.likes}
                    onChange={(e) => setIngestForm({ ...ingestForm, likes: e.target.value })}
                    className="bg-[#161B27] border border-[#1E2535] rounded p-2 text-slate-200 text-xs font-mono outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Comments"
                    value={ingestForm.comments}
                    onChange={(e) => setIngestForm({ ...ingestForm, comments: e.target.value })}
                    className="bg-[#161B27] border border-[#1E2535] rounded p-2 text-slate-200 text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">Collection Method</label>
                  <select
                    value={ingestForm.collection_method}
                    onChange={(e: any) => setIngestForm({ ...ingestForm, collection_method: e.target.value })}
                    className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs focus:border-indigo-500 outline-none"
                  >
                    <option value="user_url">User-Provided URL</option>
                    <option value="manual_entry">Manual Observation</option>
                    <option value="dataset_export">Dataset / CSV Export</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">Provenance Notes</label>
                  <input
                    type="text"
                    value={ingestForm.provenance_notes}
                    onChange={(e) => setIngestForm({ ...ingestForm, provenance_notes: e.target.value })}
                    className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E2535]">
                <button
                  type="button"
                  onClick={() => setShowIngestModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#161B27] text-slate-300 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingesting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  {ingesting ? 'Saving...' : 'Save Observation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Propose New Experiment */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11151E] border border-[#1E2535] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#1E2535] pb-3">
              <h3 className="text-base font-bold text-slate-100">Propose Controlled Experiment</h3>
              <button
                onClick={() => setShowExpModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExperiment} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Experiment Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3-Second Question Hook vs Statement Hook"
                  value={expForm.title}
                  onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
                  className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Proposed Change *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="The concrete change to test..."
                  value={expForm.proposed_change}
                  onChange={(e) => setExpForm({ ...expForm, proposed_change: e.target.value })}
                  className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Evidence Rationale & Mechanism</label>
                <textarea
                  rows={2}
                  placeholder="What evidence suggests this will help..."
                  value={expForm.evidence_rationale}
                  onChange={(e) => setExpForm({ ...expForm, evidence_rationale: e.target.value })}
                  className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">Evaluation Metric</label>
                  <input
                    type="text"
                    value={expForm.evaluation_metric}
                    onChange={(e) => setExpForm({ ...expForm, evaluation_metric: e.target.value })}
                    className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">Sample Target</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={expForm.sample_required}
                    onChange={(e) => setExpForm({ ...expForm, sample_required: parseInt(e.target.value, 10) || 3 })}
                    className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E2535]">
                <button
                  type="button"
                  onClick={() => setShowExpModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#161B27] text-slate-300 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Propose Experiment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Experiment Outcome */}
      {outcomeModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11151E] border border-[#1E2535] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#1E2535] pb-3">
              <h3 className="text-base font-bold text-slate-100">Record Experiment Outcome</h3>
              <button
                onClick={() => setOutcomeModal({ open: false, expId: '', title: '' })}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Experiment: <span className="font-semibold text-slate-100">{outcomeModal.title}</span>
            </p>

            <form onSubmit={handleRecordOutcomeSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Measured Outcome Summary *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Record actual measured metrics across test posts against baseline..."
                  value={outcomeText}
                  onChange={(e) => setOutcomeText(e.target.value)}
                  className="w-full bg-[#0E1118] border border-[#1E2535] rounded-lg p-2.5 text-slate-200 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOutcomeModal({ open: false, expId: '', title: '' })}
                  className="px-4 py-2 rounded-lg bg-[#161B27] text-slate-300 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Save Outcome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

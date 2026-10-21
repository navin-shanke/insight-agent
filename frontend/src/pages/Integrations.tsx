import React, { useEffect, useState } from 'react';
import {
  Cable,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Send,
  Cloud,
  Search,
  Bot,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { SkeletonCard } from '../design-system/components/SkeletonCard';
import { fetchIntegrationsStatus, fetchTelegramConfig } from '../api/integrations';
import { IntegrationService, TelegramConfig } from '../types';

export const Integrations: React.FC = () => {
  const [services, setServices] = useState<IntegrationService[]>([]);
  const [telegram, setTelegram] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, tRes] = await Promise.all([
        fetchIntegrationsStatus().catch(() => ({ services: [] })),
        fetchTelegramConfig().catch(() => null),
      ]);
      setServices(sRes.services || []);
      setTelegram(tRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cable className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Integrations & Services
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Live telemetry for connected LLM engines, search providers, notification endpoints, and archives.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#11151E] hover:bg-[#161B27] text-slate-300 border border-[#1E2535] transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Test Connections</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((svc) => {
              const isConnected = svc.status === 'connected';
              const isPlanned = svc.status === 'planned';

              return (
                <div
                  key={svc.name}
                  className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#161B27] border border-[#1E2535] flex items-center justify-center text-indigo-400">
                        {svc.name.includes('Ollama') ? (
                          <Bot className="w-5 h-5" />
                        ) : svc.name.includes('DuckDuckGo') ? (
                          <Search className="w-5 h-5" />
                        ) : svc.name.includes('Telegram') ? (
                          <Send className="w-5 h-5" />
                        ) : (
                          <Cloud className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-slate-100">{svc.name}</h3>
                        <p className="text-[11px] text-slate-400">{svc.detail || 'Service adapter'}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isConnected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : isPlanned
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}
                    >
                      {isConnected ? 'Connected' : isPlanned ? 'Planning Only' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Telegram Safe Configuration Card */}
          <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-semibold text-slate-200">
                  Telegram Notifications Status
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Tokens strictly masked server-side</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Telegram Enabled
                </span>
                <span className="font-mono text-slate-200">
                  {telegram?.enabled ? 'Yes (True)' : 'No (False)'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Credentials Configured
                </span>
                <span className="font-mono text-slate-200">
                  {telegram?.configured ? 'Yes (Present in .env)' : 'No (Unset)'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Authorized Chat ID
                </span>
                <span className="font-mono text-indigo-400">
                  {telegram?.chat_id_masked || 'None'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              To enable Telegram discovery digest delivery, specify <code className="text-slate-300 font-mono">TELEGRAM_BOT_TOKEN</code> and <code className="text-slate-300 font-mono">TELEGRAM_CHAT_ID</code> in your local <code className="text-slate-300 font-mono">.env</code> file. No test messages will be sent without explicit authorization.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

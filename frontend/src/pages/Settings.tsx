import React from 'react';
import { Settings as SettingsIcon, Shield, Database, Lock, Sliders, Cpu } from 'lucide-react';

export const Settings: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1E2535]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SettingsIcon className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              System Settings & Architecture
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Operational boundaries, database governance, model router parameters, and authentication status.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Safety & Phase Policy */}
        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Safety Governance & Hard Boundaries</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535] space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                Active Phase Scope
              </span>
              <p className="text-slate-200 font-medium">Phase 5 (Dashboard & API)</p>
              <p className="text-[11px] text-slate-400">
                Phase 6 is unauthorized and disabled.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535] space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                Database Governance
              </span>
              <p className="text-slate-200 font-medium">Local SQLite + Protected Original</p>
              <p className="text-[11px] text-slate-400">
                Production database migrations require separate explicit verification.
              </p>
            </div>
          </div>
        </div>

        {/* Operational Limits */}
        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Operational Constraints & Ceilings</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Max Sources / Run
              </span>
              <span className="font-mono text-slate-200">100</span>
            </div>

            <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Max Deep Investigations
              </span>
              <span className="font-mono text-slate-200">20</span>
            </div>

            <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Max Iterations
              </span>
              <span className="font-mono text-slate-200">5 loops</span>
            </div>

            <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Max Run Duration
              </span>
              <span className="font-mono text-slate-200">45 minutes</span>
            </div>
          </div>
        </div>

        {/* Retention & Privacy Policy */}
        <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>Data Retention & Provenance</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Raw Content Retention
              </span>
              <span className="font-mono text-slate-200">90 Days</span>
            </div>

            <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Audit Trail Retention
              </span>
              <span className="font-mono text-slate-200">180 Days</span>
            </div>

            <div className="p-3 rounded-lg bg-[#0E1118] border border-[#1E2535]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Provenance Grounding
              </span>
              <span className="font-mono text-indigo-400">Strict Source URLs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

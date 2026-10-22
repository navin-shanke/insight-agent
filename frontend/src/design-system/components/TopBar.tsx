import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Plus, Activity, LogOut, CheckCircle2, Command, Cpu } from 'lucide-react';
import { logout } from '../../api/auth';
import { fetchIntegrationsStatus } from '../../api/integrations';

interface TopBarProps {
  onOpenCommandPalette?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenCommandPalette }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [engineReady, setEngineReady] = useState(true);

  useEffect(() => {
    fetchIntegrationsStatus()
      .then((data) => {
        const ollama = data.services?.find((s) => s.name.toLowerCase().includes('ollama'));
        if (ollama && ollama.status === 'connected') {
          setEngineReady(true);
        }
      })
      .catch(() => {});
  }, []);

  // Compute breadcrumb title based on pathname
  const getPageTitle = (path: string) => {
    if (path.startsWith('/overview')) return 'Intelligence Overview';
    if (path.startsWith('/discover')) return 'Research Composer';
    if (path.startsWith('/tasks')) return 'Research Operations';
    if (path.startsWith('/reports')) return 'Reports & Intelligence Dossiers';
    if (path.startsWith('/feed')) return 'Discovery Feed';
    if (path.startsWith('/evidence')) return 'Evidence Explorer';
    if (path.startsWith('/instagram')) return 'Instagram Intelligence Studio';
    if (path.startsWith('/integrations')) return 'Engine Telemetry & Health';
    if (path.startsWith('/settings')) return 'Workspace Settings';
    if (path.startsWith('/watchlists')) return 'Topic Watchlists';
    if (path.startsWith('/schedules')) return 'Scheduled Discovery';
    return 'Intelligence Workspace';
  };

  return (
    <header className="h-14 border-b border-[#222938] bg-[#0E111A]/85 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Breadcrumbs & Quick Search Trigger */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Insight</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200 font-semibold">{getPageTitle(location.pathname)}</span>
        </div>

        {/* Global Search / Command Palette Pill */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#141824] border border-[#262D3D] text-xs text-slate-400 hover:text-slate-200 hover:border-indigo-500/40 transition-all w-52 md:w-72 justify-between group shadow-inner"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
            <span className="truncate">Search commands, topics...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-[#1B2130] rounded border border-[#2A3448]">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* System / Connection status pill */}
        <div
          onClick={() => navigate('/integrations')}
          className="cursor-pointer flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#141824] border border-[#262D3D] text-[11px] text-slate-300 hover:border-slate-600 transition-colors"
          title="Engine Status: Local LLM & DuckDuckGo Ready"
        >
          <span className={`w-2 h-2 rounded-full ${engineReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="font-mono font-medium hidden sm:inline">Engine Active</span>
        </div>

        {/* Primary CTA: Start Research */}
        <button
          onClick={() => navigate('/discover')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/25 active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Research</span>
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#1A202E] rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

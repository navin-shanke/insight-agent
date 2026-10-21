import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Activity, LogOut, CheckCircle2 } from 'lucide-react';
import { logout } from '../../api/auth';

interface TopBarProps {
  onSearch?: (term: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onSearch }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      if (onSearch) {
        onSearch(searchTerm);
      } else {
        navigate(`/feed?q=${encodeURIComponent(searchTerm)}`);
      }
    }
  };

  return (
    <header className="h-14 border-b border-[#1E2535] bg-[#0E1118]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Global Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative w-80">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search research, claims, topics..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#11151E] border border-[#1E2535] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
        />
      </form>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* System / Connection status */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#11151E] border border-[#1E2535] text-[11px] text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-slate-300">System Ready</span>
        </div>

        {/* Quick-action button: Start Research */}
        <button
          onClick={() => navigate('/discover')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Research</span>
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#161B27] rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

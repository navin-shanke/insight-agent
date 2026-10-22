import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Compass,
  LayoutDashboard,
  Radio,
  FileText,
  SearchCode,
  ListTodo,
  Brain,
  Cable,
  Settings,
  Sparkles,
  ArrowRight,
  X,
  Upload,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    {
      id: 'cmd-discover',
      title: 'Launch New Investigation',
      category: 'Actions',
      icon: Compass,
      action: () => navigate('/discover'),
      shortcut: 'N',
    },
    {
      id: 'cmd-instagram-import',
      title: 'Instagram Batch Import (CSV/JSON)',
      category: 'Actions',
      icon: Upload,
      action: () => navigate('/instagram'),
    },
    {
      id: 'cmd-overview',
      title: 'Go to Intelligence Overview',
      category: 'Navigation',
      icon: LayoutDashboard,
      action: () => navigate('/overview'),
    },
    {
      id: 'cmd-tasks',
      title: 'View Active & Recent Research Tasks',
      category: 'Navigation',
      icon: ListTodo,
      action: () => navigate('/tasks'),
    },
    {
      id: 'cmd-reports',
      title: 'Browse Intelligence Dossiers & Reports',
      category: 'Navigation',
      icon: FileText,
      action: () => navigate('/reports'),
    },
    {
      id: 'cmd-feed',
      title: 'Inspect Discovery Intelligence Feed',
      category: 'Navigation',
      icon: Radio,
      action: () => navigate('/feed'),
    },
    {
      id: 'cmd-evidence',
      title: 'Open Fine-Grained Evidence Explorer',
      category: 'Navigation',
      icon: SearchCode,
      action: () => navigate('/evidence'),
    },
    {
      id: 'cmd-instagram',
      title: 'Open Instagram Adaptive Learning Studio',
      category: 'Navigation',
      icon: Brain,
      action: () => navigate('/instagram'),
    },
    {
      id: 'cmd-integrations',
      title: 'Engine Telemetry & Integrations Status',
      category: 'System',
      icon: Cable,
      action: () => navigate('/integrations'),
    },
    {
      id: 'cmd-settings',
      title: 'System Preferences & Settings',
      category: 'System',
      icon: Settings,
      action: () => navigate('/settings'),
    },
  ];

  const filteredCommands = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl rounded-2xl bg-[#121622] border border-[#262D3D] shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#262D3D] flex items-center gap-3 bg-[#151925]">
          <Search className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, route, or action..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-[#1C2230] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Items List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-[#1A202E]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#181D2A] text-indigo-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{item.title}</div>
                      <div className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {item.category}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 text-[11px]">
                    {item.shortcut && (
                      <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#181D2A] text-slate-400 border border-[#262D3D]'
                      }`}>
                        {item.shortcut}
                      </span>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching commands or actions found.
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-[#0F131D] border-t border-[#262D3D] flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#181D2A] border border-[#262D3D] text-[10px] font-mono text-slate-400">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#181D2A] border border-[#262D3D] text-[10px] font-mono text-slate-400">↵</kbd> Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#181D2A] border border-[#262D3D] text-[10px] font-mono text-slate-400">Esc</kbd> Close
            </span>
          </div>
          <span className="font-mono text-[10px] text-indigo-400 font-semibold">Insight Command</span>
        </div>
      </div>
    </div>
  );
};

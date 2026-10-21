import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  LayoutDashboard,
  Radio,
  FileText,
  SearchCode,
  ListTodo,
  Eye,
  Calendar,
  Cable,
  Settings,
  Sparkles,
  Brain,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const workspaceNav: NavItem[] = [
  { name: 'Overview', path: '/overview', icon: LayoutDashboard },
  { name: 'Discover', path: '/discover', icon: Compass },
  { name: 'Intelligence Feed', path: '/feed', icon: Radio },
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'Evidence Explorer', path: '/evidence', icon: SearchCode },
  { name: 'Instagram Intelligence', path: '/instagram', icon: Brain },
];

const automationNav: NavItem[] = [
  { name: 'Research Tasks', path: '/tasks', icon: ListTodo },
  { name: 'Watchlists', path: '/watchlists', icon: Eye },
  { name: 'Schedules', path: '/schedules', icon: Calendar },
];

const systemNav: NavItem[] = [
  { name: 'Integrations', path: '/integrations', icon: Cable },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const AppSidebar: React.FC = () => {
  return (
    <aside className="w-64 flex-shrink-0 bg-[#0E1118] border-r border-[#1E2535] flex flex-col justify-between h-screen select-none sticky top-0">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand header */}
        <div className="p-5 border-b border-[#1E2535]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <Sparkles className="w-4 h-4 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-wider text-slate-100 uppercase">
                  Insight
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono tracking-wide rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Phase 5
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Research Intelligence</p>
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <div className="p-3 space-y-6 flex-1">
          {/* Workspace */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Workspace
            </div>
            <nav className="space-y-0.5">
              {workspaceNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-[#1E2538] text-indigo-400 font-semibold shadow-sm border border-indigo-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B27]'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Automation */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Automation
            </div>
            <nav className="space-y-0.5">
              {automationNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-[#1E2538] text-indigo-400 font-semibold shadow-sm border border-indigo-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B27]'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          {/* System */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              System
            </div>
            <nav className="space-y-0.5">
              {systemNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-[#1E2538] text-indigo-400 font-semibold shadow-sm border border-indigo-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B27]'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#1E2535] bg-[#0B0D12]/60">
        <div className="px-3 py-2 rounded-lg bg-[#11151E] border border-[#1E2535] flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-mono">SQLite Local</span>
          </div>
          <span className="text-slate-400 text-[10px]">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
};

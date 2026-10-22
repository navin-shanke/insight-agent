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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const workspaceNav: NavItem[] = [
  { name: 'Overview', path: '/overview', icon: LayoutDashboard },
  { name: 'Discover', path: '/discover', icon: Compass },
  { name: 'Intelligence Feed', path: '/feed', icon: Radio },
  { name: 'Reports & Dossiers', path: '/reports', icon: FileText },
  { name: 'Evidence Explorer', path: '/evidence', icon: SearchCode },
  { name: 'Instagram Studio', path: '/instagram', icon: Brain, badge: 'Adaptive' },
];

const automationNav: NavItem[] = [
  { name: 'Research Tasks', path: '/tasks', icon: ListTodo },
  { name: 'Watchlists', path: '/watchlists', icon: Eye },
  { name: 'Schedules', path: '/schedules', icon: Calendar },
];

const systemNav: NavItem[] = [
  { name: 'Engine & Telemetry', path: '/integrations', icon: Cable },
  { name: 'Settings', path: '/settings', icon: Settings },
];

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`flex-shrink-0 bg-[#0E111A] border-r border-[#222938] flex flex-col justify-between h-screen select-none sticky top-0 transition-all duration-200 z-30 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand header */}
        <div className="p-4 border-b border-[#222938]/80 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-600/25 text-white flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-slate-100">
                    Insight Agent
                  </span>
                  <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">Autonomous Research Platform</p>
              </div>
            )}
          </div>

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1A202E] transition-colors hidden md:block"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="p-3 space-y-6 flex-1">
          {/* Workspace */}
          <div>
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Workspace
              </div>
            )}
            <nav className="space-y-1">
              {workspaceNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600/25 to-indigo-600/10 text-indigo-300 font-semibold border border-indigo-500/35 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#151925]'
                    } ${collapsed ? 'justify-center px-2' : ''}`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0 text-indigo-400" />
                  {!collapsed && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="truncate">{item.name}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-pink-500/15 text-pink-300 border border-pink-500/30">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Operations & Automation */}
          <div>
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Operations
              </div>
            )}
            <nav className="space-y-1">
              {automationNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600/25 to-indigo-600/10 text-indigo-300 font-semibold border border-indigo-500/35 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#151925]'
                    } ${collapsed ? 'justify-center px-2' : ''}`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* System */}
          <div>
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                System
              </div>
            )}
            <nav className="space-y-1">
              {systemNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600/25 to-indigo-600/10 text-indigo-300 font-semibold border border-indigo-500/35 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#151925]'
                    } ${collapsed ? 'justify-center px-2' : ''}`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Footer Info / Telemetry */}
      <div className="p-3 border-t border-[#222938] bg-[#0A0D14]">
        {!collapsed ? (
          <div className="p-2.5 rounded-xl bg-[#121622] border border-[#222938] flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-mono font-medium">Local Engine</span>
            </div>
            <span className="text-slate-400 font-mono text-[10px]">v1.0-prod</span>
          </div>
        ) : (
          <div className="flex justify-center p-1" title="Local Engine Active">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
};

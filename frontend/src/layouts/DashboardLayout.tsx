import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from '../design-system/components/AppSidebar';
import { TopBar } from '../design-system/components/TopBar';
import { CommandPalette } from '../design-system/components/CommandPalette';

export const DashboardLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-[#0B0D12] text-slate-100 overflow-hidden font-sans">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <TopBar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
        <main className="flex-1 p-5 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
};

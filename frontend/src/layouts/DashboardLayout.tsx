import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from '../design-system/components/AppSidebar';
import { TopBar } from '../design-system/components/TopBar';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-[#0B0D12] text-slate-100 overflow-hidden font-sans">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <TopBar />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

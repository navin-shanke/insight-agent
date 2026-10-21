import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Discover } from './pages/Discover';
import { ResearchTasks } from './pages/ResearchTasks';
import { IntelligenceFeed } from './pages/IntelligenceFeed';
import { Reports } from './pages/Reports';
import { ReportDetail } from './pages/ReportDetail';
import { EvidenceExplorer } from './pages/EvidenceExplorer';
import { InstagramIntelligence } from './pages/InstagramIntelligence';
import { Watchlists } from './pages/Watchlists';
import { Schedules } from './pages/Schedules';
import { Integrations } from './pages/Integrations';
import { Settings } from './pages/Settings';
import { isAuthenticated } from './api/auth';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // If not authenticated, redirect to login
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/overview" replace />,
      },
      {
        path: 'overview',
        element: <Overview />,
      },
      {
        path: 'discover',
        element: <Discover />,
      },
      {
        path: 'feed',
        element: <IntelligenceFeed />,
      },
      {
        path: 'reports',
        element: <Reports />,
      },
      {
        path: 'reports/:id',
        element: <ReportDetail />,
      },
      {
        path: 'evidence',
        element: <EvidenceExplorer />,
      },
      {
        path: 'instagram',
        element: <InstagramIntelligence />,
      },
      {
        path: 'tasks',
        element: <ResearchTasks />,
      },
      {
        path: 'watchlists',
        element: <Watchlists />,
      },
      {
        path: 'schedules',
        element: <Schedules />,
      },
      {
        path: 'integrations',
        element: <Integrations />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/overview" replace />,
  },
]);

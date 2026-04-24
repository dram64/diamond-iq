import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './components/RootLayout';
import { HomePage } from './pages/HomePage';
import { LiveGamePage } from './pages/LiveGamePage';
import { ComparePage } from './pages/ComparePage';
import { TeamsPage } from './pages/TeamsPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { StatsPage } from './pages/StatsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'live', element: <Navigate to="/" replace /> },
      { path: 'live/:gameId', element: <LiveGamePage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:teamId', element: <TeamDetailPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

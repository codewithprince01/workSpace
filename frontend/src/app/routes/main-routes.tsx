import { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from '@/layouts/MainLayout';
import settingsRoutes from './settings-routes';
import adminCenterRoutes from './admin-center-routes';
import { useAuthService } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

// Lazy load page components for better code splitting
const HomePage = lazy(() => import('@/pages/home/home-page'));
const ProjectList = lazy(() => import('@/pages/projects/project-list'));
const Schedule = lazy(() => import('@/pages/schedule/schedule'));

const ProjectView = lazy(() => import('@/pages/projects/projectView/project-view'));
const Unauthorized = lazy(() => import('@/pages/unauthorized/unauthorized'));
const GanttDemoPage = lazy(() => import('@/pages/GanttDemoPage'));
const CalendarPage = lazy(() => import('@/pages/calendar/calendar-page'));
const TodoPage = lazy(() => import('@/features/todo/TodoPage'));
const ProjectInvitePage = lazy(() => import('@/pages/auth/ProjectInvitePage'));
const GlobalProjectsPage = lazy(() => import('@/features/super-admin/GlobalProjectsPage'));

// Define AdminGuard component with defensive programming
const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const authService = useAuthService();
  const location = useLocation();

  try {
    // Defensive checks to ensure authService and its methods exist
    if (
      !authService ||
      typeof authService.isAuthenticated !== 'function' ||
      typeof authService.isOwnerOrAdmin !== 'function'
    ) {
      // If auth service is not ready, render children (don't block)
      return <>{children}</>;
    }

    if (!authService.isAuthenticated()) {
      return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    // if (!authService.isOwnerOrAdmin()) {
    //   return <Navigate to="/workspace/unauthorized" replace />;
    // }

    return <>{children}</>;
  } catch (error) {
    console.error('Error in AdminGuard (main-routes):', error);
    // On error, render children to prevent complete blocking
    return <>{children}</>;
  }
};

const mainRoutes: RouteObject[] = [
  {
    path: '/workspace',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: 'home',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'projects',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <ProjectList />
          </Suspense>
        ),
      },
      {
        path: 'schedule',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <AdminGuard>
              <Schedule />
            </AdminGuard>
          </Suspense>
        ),
      },
      {
        path: `projects/:projectId`,
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <ProjectView />
          </Suspense>
        ),
      },
      {
        path: 'unauthorized',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <Unauthorized />
          </Suspense>
        ),
      },
      {
        path: 'gantt-demo',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <GanttDemoPage />
          </Suspense>
        ),
      },
      {
        path: 'calendar',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <CalendarPage />
          </Suspense>
        ),
      },
      {
        path: 'todo',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <TodoPage />
          </Suspense>
        ),
      },
      {
        path: 'global-projects',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <GlobalProjectsPage />
          </Suspense>
        ),
      },
      {
        path: 'invite/project/:token',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <ProjectInvitePage />
          </Suspense>
        ),
      },
      ...settingsRoutes,
      ...adminCenterRoutes,
    ],
  },
];

export default mainRoutes;

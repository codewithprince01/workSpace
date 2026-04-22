import { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));

const rootRoutes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <LandingPage />
      </Suspense>
    ),
  },
];

export default rootRoutes;

import { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import SettingsLayout from '@/layouts/SettingsLayout';
import { settingsItems } from '@/lib/settings/settings-constants';
import { useAuthService } from '@/hooks/useAuth';
import { useProjectRole } from '@/services/project-role/projectRole.service';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const SettingsGuard = ({
  children,
  adminRequired,
}: {
  children: React.ReactNode;
  adminRequired: boolean;
}) => {
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { projectRole } = useProjectRole();

  // If admin-only setting is requested but user is in an invited project, redirect to profile
  if (adminRequired && !projectRole.isInOwnTeam) {
    return <Navigate to="/worklenz/settings/profile" replace />;
  }

  // If admin-only setting is requested but user is not admin/owner, redirect to profile
  if (adminRequired && !isOwnerOrAdmin) {
    return <Navigate to="/worklenz/settings/profile" replace />;
  }

  return <>{children}</>;
};

const settingsRoutes: RouteObject[] = [
  {
    path: 'settings',
    element: <SettingsLayout />,
    children: settingsItems.map(item => ({
      path: item.endpoint,
      element: (
        <Suspense fallback={<SuspenseFallback />}>
          <SettingsGuard adminRequired={!!item.adminOnly}>{item.element}</SettingsGuard>
        </Suspense>
      ),
    })),
  },
];

export default settingsRoutes;

import { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import SettingsLayout from '@/layouts/SettingsLayout';
import { settingsItems, canAccessSetting } from '@/lib/settings/settings-constants';
import { useAuthService } from '@/hooks/useAuth';
import { useProjectRole } from '@/services/project-role/projectRole.service';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const SettingsGuard = ({
  children,
  settingItem,
}: {
  children: React.ReactNode;
  settingItem: (typeof settingsItems)[number];
}) => {
  const authService = useAuthService();
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();
  const currentSession = authService.getCurrentSession();
  const { projectRole } = useProjectRole();

  const hasAccess = canAccessSetting(
    settingItem,
    isOwnerOrAdmin,
    projectRole.isInOwnTeam,
    projectRole.projectRole,
    currentSession?.team_role
  );

  if (!hasAccess) {
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
          <SettingsGuard settingItem={item}>{item.element}</SettingsGuard>
        </Suspense>
      ),
    })),
  },
];

export default settingsRoutes;

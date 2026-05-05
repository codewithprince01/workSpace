import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Col, ConfigProvider, Flex, Menu, Button, Tooltip, Badge } from '@/shared/antd-imports';
import { createPortal } from 'react-dom';
import { CrownFilled } from '@ant-design/icons';

import InviteTeamMembers from '../../components/common/invite-team-members/invite-team-members';
import InviteButton from './invite/InviteButton';
import MobileMenuButton from './mobile-menu/MobileMenuButton';
import NavbarLogo from './NavbarLogo';
import NotificationButton from '../../components/navbar/notifications/notifications-drawer/notification/notification-button';
import ProfileButton from './user-profile/ProfileButton';
import SwitchTeamButton from './switch-team/SwitchTeamButton';
import UpgradePlanButton from './upgrade-plan/UpgradePlanButton';
import NotificationDrawer from '../../components/navbar/notifications/notifications-drawer/notification/notfication-drawer';
import OrgSwitcherModal from '@/components/super-admin/OrgSwitcherModal';

import { useResponsive } from '@/hooks/useResponsive';
import { getJSONFromLocalStorage } from '@/utils/localStorageFunctions';
import { navRoutes, NavRoutesType } from './navRoutes';
import { useAuthService } from '@/hooks/useAuth';
import { authApiService } from '@/api/auth/auth.api.service';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import TimerButton from './timers/TimerButton';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useProjectRole } from '@/services/project-role/projectRole.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setUser } from '@/features/user/userSlice';
import {
  setIsSuperAdmin,
  openOrgSwitcher,
  fetchSuperAdminContext,
} from '@/features/super-admin/superAdminSlice';

const Navbar = () => {
  const dispatch = useAppDispatch();
  const [current, setCurrent] = useState<string>('home');
  const currentSession = useAuthService().getCurrentSession();
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);
  const isSuperAdmin = useAppSelector(state => state.superAdminReducer.isSuperAdmin);
  const superAdminContext = useAppSelector(state => state.superAdminReducer.context);

  const location = useLocation();
  const { isDesktop, isMobile, isTablet } = useResponsive();
  const { t } = useTranslation('navbar');
  const authService = useAuthService();
  const { setIdentity } = useMixpanelTracking();
  const [navRoutesList, setNavRoutesList] = useState<NavRoutesType[]>(navRoutes);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState<boolean>(authService.isOwnerOrAdmin());
  const { projectRole, setCurrentProject } = useProjectRole();
  const showUpgradeTypes = [
    ISUBSCRIPTION_TYPE.TRIAL,
  ];

  // Filter nav routes based on current permissions
  useEffect(() => {
    const filteredRoutes = navRoutes.filter(route => {
      // Filter out trash from navbar (trash is already in settings)
      if (route.name === 'trash') {
        return false;
      }

      // Filter out super-admin-only routes for non-super-admins
      if (route.superAdminOnly && !isSuperAdmin) {
        return false;
      }
      
      // Filter out reports if user doesn't have reports access
      if (route.requiresReportsAccess && !projectRole.canAccessReports) {
        return false;
      }
      
      // Keep routes based on adminOnly flag
      if (route.adminOnly && !isOwnerOrAdmin) {
        return false;
      }
      
      return true;
    });
    
    setNavRoutesList(filteredRoutes);
  }, [projectRole.canAccessReports, isOwnerOrAdmin, isSuperAdmin]);

  useEffect(() => {
    authApiService
      .verify()
      .then(authorizeResponse => {
        if (authorizeResponse.authenticated) {
          const user = (authorizeResponse as any).data?.user || authorizeResponse.user;
          if (user) {
            authService.setCurrentSession(user);
            dispatch(setUser(user));
            setIdentity(user);
            setIsOwnerOrAdmin(!!(user.is_admin || user.owner));

            // ── Super Admin bootstrap ─────────────────────────────────────
            const isSuper = user.role === 'super_admin' || user.is_super_admin === true;
            dispatch(setIsSuperAdmin(isSuper));
            if (isSuper) {
              dispatch(fetchSuperAdminContext());
            }
          }
        }
      })
      .catch(error => {
        logger.error('Error during authorization', error);
      });
  }, []);

  // Initial population of nav routes handled by the filtered effect above

  useEffect(() => {
    if (currentSession?.trial_expire_date) {
      const today = new Date();
      const expiryDate = new Date(currentSession.trial_expire_date);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysUntilExpiry(diffDays);
    }
  }, [currentSession?.trial_expire_date]);

  const navlinkItems = useMemo(
    () =>
      navRoutesList
        .filter(route => {
          if (
            !route.freePlanFeature &&
            currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE
          )
            return false;
          if (route.adminOnly && !isOwnerOrAdmin) return false;

          return true;
        })
        .map((route, index) => ({
          key: route.path.split('/').pop() || index,
          label: route.superAdminOnly ? (
            <Link to={route.path} style={{ fontWeight: 700, color: '#6366f1' }}>
              <CrownFilled style={{ marginRight: 4, fontSize: 12 }} />
              {route.name}
            </Link>
          ) : (
            <Link to={route.path} style={{ fontWeight: 600 }}>
              {t(route.name)}
            </Link>
          ),
        })),
    [navRoutesList, t, isOwnerOrAdmin, currentSession?.subscription_type]
  );

  useEffect(() => {
    const afterWorklenzString = location.pathname.split('/worklenz/')[1];
    const pathKey = afterWorklenzString.split('/')[0];

    setCurrent(pathKey ?? 'home');
  }, [location]);

  return (
    <Col
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        paddingInline: isDesktop ? 48 : 24,
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Flex
        style={{
          width: '100%',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* logo */}
        <NavbarLogo />

        <Flex
          align="center"
          justify={isDesktop ? 'space-between' : 'flex-end'}
          style={{ width: '100%' }}
        >
          {/* navlinks menu  */}
          {isDesktop && (
            <Menu
              selectedKeys={[current]}
              mode="horizontal"
              style={{
                flex: 10,
                maxWidth: 720,
                minWidth: 0,
                border: 'none',
              }}
              items={navlinkItems}
            />
          )}

          <Flex gap={20} align="center">
            <ConfigProvider wave={{ disabled: true }}>
              {isDesktop && (
                <Flex gap={20} align="center">
                  {isOwnerOrAdmin &&
                    showUpgradeTypes.includes(
                      currentSession?.subscription_type as ISUBSCRIPTION_TYPE
                    ) && <UpgradePlanButton />}
                  {projectRole.canInviteMembers && <InviteButton />}
                  <Flex align="center" gap={12}>
                    {/* Super Admin: Switch Org button */}
                    {isSuperAdmin && (
                      <Tooltip title={superAdminContext?.active_team_id
                        ? `Viewing: ${superAdminContext.active_team_name}`
                        : 'Switch Organization (Super Admin)'
                      }>
                        <Button
                          type={superAdminContext?.active_team_id ? 'primary' : 'text'}
                          shape="circle"
                          icon={<CrownFilled style={{ color: superAdminContext?.active_team_id ? '#fff' : '#6366f1' }} />}
                          onClick={() => dispatch(openOrgSwitcher())}
                          style={{
                            background: superAdminContext?.active_team_id
                              ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                              : 'transparent',
                            border: superAdminContext?.active_team_id ? 'none' : '1.5px solid #6366f1',
                            boxShadow: superAdminContext?.active_team_id
                              ? '0 2px 8px rgba(99,102,241,0.4)'
                              : 'none',
                          }}
                        />
                      </Tooltip>
                    )}
                    <SwitchTeamButton />
                    <NotificationButton />
                    <TimerButton />
                    <ProfileButton isOwnerOrAdmin={isOwnerOrAdmin} />
                  </Flex>
                </Flex>
              )}
              {isTablet && !isDesktop && (
                <Flex gap={12} align="center">
                  {isSuperAdmin && (
                    <Tooltip title="Switch Organization">
                      <Button
                        type="text"
                        shape="circle"
                        icon={<CrownFilled style={{ color: '#6366f1' }} />}
                        onClick={() => dispatch(openOrgSwitcher())}
                      />
                    </Tooltip>
                  )}
                  <SwitchTeamButton />
                  <NotificationButton />
                  <ProfileButton isOwnerOrAdmin={isOwnerOrAdmin} />
                  <MobileMenuButton />
                </Flex>
              )}
              {isMobile && (
                <Flex gap={12} align="center">
                  <NotificationButton />
                  <ProfileButton isOwnerOrAdmin={isOwnerOrAdmin} />
                  <MobileMenuButton />
                </Flex>
              )}
            </ConfigProvider>
          </Flex>
        </Flex>
      </Flex>

      {createPortal(<InviteTeamMembers />, document.body, 'invite-team-members')}
      {createPortal(<NotificationDrawer />, document.body, 'notification-drawer')}
      {isSuperAdmin && createPortal(<OrgSwitcherModal />, document.body, 'org-switcher-modal')}
    </Col>
  );
};

export default Navbar;

// Ant Design Icons
import { BankOutlined, CaretDownFilled, CheckCircleFilled } from '@/shared/antd-imports';

// Ant Design Components
import { Card, Divider, Dropdown, Flex, Tooltip, Typography } from '@/shared/antd-imports';

// Redux Hooks
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';

// Redux Actions
import { fetchTeams, setActiveTeam } from '@/features/teams/teamSlice';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';

// Hooks & Services
import { useAuthService } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createAuthService } from '@/services/auth/auth.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_common_switch_team } from '@/shared/worklenz-analytics-events';
import { useProjectRole } from '@/services/project-role/projectRole.service';

// Components
import CustomAvatar from '@/components/CustomAvatar';

// Styles
import { colors } from '@/styles/colors';
import './switchTeam.css';
import { useCallback, useEffect, useMemo, useRef } from 'react';

const AUTO_SWITCH_KEY_PREFIX = 'worklenz_auto_admin_team_switch';

const SwitchTeamButton = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authService = createAuthService(navigate);
  const { getCurrentSession } = useAuthService();
  const session = getCurrentSession();
  const { t } = useTranslation('navbar');
  const { setIdentity, trackMixpanelEvent } = useMixpanelTracking();
  const { setCurrentProject } = useProjectRole();
  const autoSwitchAttemptedRef = useRef(false);

  // Selectors
  const teamsList = useAppSelector(state => state.teamReducer.teamsList);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const normalizeTeamText = useCallback((value?: string) => (value || '').trim().toLowerCase(), []);

  const displayTeams = useMemo(() => {
    if (!teamsList?.length) return [];

    return teamsList.filter(team => {
      const ownerName = normalizeTeamText(team.owns_by);
      const teamName = normalizeTeamText(team.name);

      if (!ownerName || !teamName) return true;

      // Hide auto-created "<Owner>'s Team" if a cleaner "<Owner>" org/team exists.
      const defaultPersonalTeamNames = new Set([
        `${ownerName}'s team`,
        `${ownerName}s team`,
        `${ownerName} team`,
      ]);

      const isDefaultPersonalTeam = defaultPersonalTeamNames.has(teamName);
      if (!isDefaultPersonalTeam) return true;

      const hasOwnerNamedTeam = teamsList.some(t => {
        return (
          normalizeTeamText(t.owns_by) === ownerName && normalizeTeamText(t.name) === ownerName
        );
      });

      return !hasOwnerNamedTeam;
    });
  }, [normalizeTeamText, teamsList]);

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

  const isActiveTeam = (teamId: string): boolean => {
    if (!teamId || !session?.team_id) {
      return false;
    }
    return String(teamId).trim() === String(session.team_id).trim();
  };

  const handleVerifyAuth = useCallback(async () => {
    const result = await dispatch(verifyAuthentication()).unwrap();
    if (result.authenticated) {
      // Backend returns { authenticated, data: { user } } - extract user correctly
      const user = (result as any).data?.user || result.user;
      if (user) {
        dispatch(setUser(user));
        authService.setCurrentSession(user);
        setIdentity(user);
      }
    }
  }, [authService, dispatch, setIdentity]);

  const handleTeamSelect = useCallback(
    async (id: string) => {
      if (!id) return;

      trackMixpanelEvent(evt_common_switch_team);

      try {
        // 1. Activate the team on backend
        await dispatch(setActiveTeam(id)).unwrap();

        // 2. Verify auth to update session with new team_id and team_role
        await handleVerifyAuth();

        // 3. Reset RTK Query cache
        dispatch({ type: 'homePageApi/resetApiState' });

        // 4. Reset project role
        setCurrentProject(null);

        // 5. Reload page to fetch fresh data with new team context
        window.location.reload();
      } catch (error) {
        console.error('[FRONTEND] Team switch failed:', error);
      }
    },
    [dispatch, handleVerifyAuth, setCurrentProject, trackMixpanelEvent]
  );

  // Auto-switch on first login when user lands as member but owns an organization team.
  // This avoids forcing users to manually switch to see admin/owner context.
  useEffect(() => {
    if (autoSwitchAttemptedRef.current) return;
    if (!session?.team_id || !session?.team_role || !session?.name || !displayTeams.length) return;

    const currentRole = session.team_role.toLowerCase();
    if (currentRole === 'owner' || currentRole === 'admin') return;

    const ownerName = normalizeTeamText(session.name);
    if (!ownerName) return;

    const ownedTeams = displayTeams.filter(team => normalizeTeamText(team.owns_by) === ownerName);
    if (!ownedTeams.length) return;

    const defaultPersonalTeamNames = new Set([
      `${ownerName}'s team`,
      `${ownerName}s team`,
      `${ownerName} team`,
    ]);

    const preferredOwnedTeam =
      ownedTeams.find(team => normalizeTeamText(team.name) === ownerName) ||
      ownedTeams.find(team => !defaultPersonalTeamNames.has(normalizeTeamText(team.name))) ||
      ownedTeams[0];

    if (!preferredOwnedTeam?.id || preferredOwnedTeam.id === session.team_id) return;

    const userKey = session.id || session.email || 'unknown';
    const switchMarkerKey = `${AUTO_SWITCH_KEY_PREFIX}:${userKey}`;

    if (localStorage.getItem(switchMarkerKey) === preferredOwnedTeam.id) return;

    autoSwitchAttemptedRef.current = true;
    localStorage.setItem(switchMarkerKey, preferredOwnedTeam.id);
    void handleTeamSelect(preferredOwnedTeam.id);
  }, [
    displayTeams,
    handleTeamSelect,
    normalizeTeamText,
    session?.email,
    session?.id,
    session?.name,
    session?.team_id,
    session?.team_role,
  ]);

  const renderTeamCard = (team: any, index: number) => (
    <Card
      className="switch-team-card"
      onClick={() => handleTeamSelect(team.id)}
      style={{ width: 230 }}
    >
      <Flex vertical>
        <Flex gap={12} align="center" justify="space-between" style={{ padding: '4px 12px' }}>
          <Flex gap={8} align="center">
            <CustomAvatar avatarName={team.name || ''} />
            <Flex vertical>
              <Typography.Text style={{ fontSize: 11, fontWeight: 300 }}>
                Owned by {team.owns_by}
              </Typography.Text>
              <Typography.Text>{team.name}</Typography.Text>
            </Flex>
          </Flex>
          <CheckCircleFilled
            style={{
              fontSize: 16,
              color: isActiveTeam(team.id) ? '#00C853' : colors.lightGray,
            }}
          />
        </Flex>
        {index < displayTeams.length - 1 && <Divider style={{ margin: 0 }} />}
      </Flex>
    </Card>
  );

  const dropdownItems =
    displayTeams
      ?.filter((team): team is typeof team & { id: string } => !!team.id)
      .map((team, index) => ({
        key: team.id,
        label: renderTeamCard(team, index),
        type: 'item' as const,
      })) || [];

  return (
    <Dropdown
      overlayClassName="switch-team-dropdown"
      menu={{ items: dropdownItems }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Tooltip title={t('switchTeamTooltip')} trigger={'hover'}>
        <Flex
          gap={12}
          align="center"
          justify="center"
          style={{
            color: themeMode === 'dark' ? '#e6f7ff' : colors.skyBlue,
            backgroundColor: themeMode === 'dark' ? '#153450' : colors.paleBlue,
            fontWeight: 500,
            borderRadius: '50rem',
            padding: '10px 16px',
            height: '39px',
            cursor: 'pointer',
          }}
        >
          <BankOutlined />
          <Typography.Text strong style={{ color: colors.skyBlue, cursor: 'pointer' }}>
            {displayTeams.find(t => t.id === session?.team_id)?.name ||
              (() => {
                const activeTeam = teamsList.find(t => t.id === session?.team_id);
                const ownerName = normalizeTeamText(activeTeam?.owns_by);
                if (!ownerName) return session?.team_name;

                const ownerNamedTeam = displayTeams.find(
                  t =>
                    normalizeTeamText(t.owns_by) === ownerName &&
                    normalizeTeamText(t.name) === ownerName
                );
                return ownerNamedTeam?.name || session?.team_name;
              })()}
          </Typography.Text>
          <CaretDownFilled />
        </Flex>
      </Tooltip>
    </Dropdown>
  );
};

export default SwitchTeamButton;

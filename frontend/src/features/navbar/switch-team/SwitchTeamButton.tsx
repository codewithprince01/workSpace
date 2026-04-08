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
import { projectsApiService } from '@/api/projects/projects.api.service';

// Components
import CustomAvatar from '@/components/CustomAvatar';

// Styles
import { colors } from '@/styles/colors';
import './switchTeam.css';
import { useEffect } from 'react';

const SwitchTeamButton = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authService = createAuthService(navigate);
  const { getCurrentSession } = useAuthService();
  const session = getCurrentSession();
  const { t } = useTranslation('navbar');
  const { setIdentity, trackMixpanelEvent } = useMixpanelTracking();
  const { setCurrentProject } = useProjectRole();

  // Selectors
  const teamsList = useAppSelector(state => state.teamReducer.teamsList);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

  const isActiveTeam = (teamId: string): boolean => {
    if (!teamId || !session?.team_id) {
       console.log('⚠️ [ACTIVE CHECK] Missing ID:', { teamId, sessionTeamId: session?.team_id });
       return false;
    }
    const match = String(teamId).trim() === String(session.team_id).trim();
    console.log('🔍 [ACTIVE CHECK]', { teamId, sessionTeamId: session.team_id, match });
    return match;
  };

  const handleVerifyAuth = async () => {
    const result = await dispatch(verifyAuthentication()).unwrap();
    if (result.authenticated) {
      // Backend returns { authenticated, data: { user } } - extract user correctly
      const user = (result as any).data?.user || result.user;
      if (user) {
        console.log('🔍 [VERIFY-AUTH] User object received:', {
          userId: user.id,
          userName: user.name,
          teamId: user.team_id,
          teamRole: user.team_role,
          hasTeamRole: 'team_role' in user,
          fullUser: user
        });
        
        dispatch(setUser(user));
        authService.setCurrentSession(user);
        setIdentity(user);
        
        console.log('✅ [VERIFY-AUTH] Session updated with team_role:', user.team_role);
      }
    }
  };

  const handleTeamSelect = async (id: string) => {
    if (!id) return;

    console.log('🔄 [FRONTEND] Switching to team:', id);
    trackMixpanelEvent(evt_common_switch_team);
    
    try {
      // 1. Activate the team on backend
      const result = await dispatch(setActiveTeam(id)).unwrap();
      console.log('🔄 [FRONTEND] setActiveTeam result:', result);
      
      // 2. Verify auth to update session with new team_id and team_role
      await handleVerifyAuth();
      console.log('✅ [FRONTEND] Auth verified with new team');
      
      // 3. Reset RTK Query cache
      dispatch({ type: 'homePageApi/resetApiState' });
      console.log('✅ [FRONTEND] RTK Query cache reset');
      
      // 4. Reset project role
      setCurrentProject(null);
      console.log('✅ [FRONTEND] ProjectRoleProvider reset');
      
      // 5. Reload page to fetch fresh data with new team context
      console.log('🔄 [FRONTEND] Reloading page for team switch');
      window.location.reload();
      
    } catch (error) {
      console.error('❌ [FRONTEND] Team switch failed:', error);
    }
  };

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
        {index < teamsList.length - 1 && <Divider style={{ margin: 0 }} />}
      </Flex>
    </Card>
  );

  const dropdownItems =
    teamsList
      ?.filter((team): team is typeof team & { id: string } => !!team.id) // Type guard
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
            {/* Prioritize Team Name (Workspace Name) */}
            {teamsList.find(t => t.id === session?.team_id)?.name || session?.team_name}
          </Typography.Text>
          <CaretDownFilled />
        </Flex>
      </Tooltip>
    </Dropdown>
  );
};

export default SwitchTeamButton;

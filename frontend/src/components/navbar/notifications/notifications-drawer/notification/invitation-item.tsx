import { teamsApiService } from '@/api/teams/teams.api.service';
import { notificationsApiService } from '@/api/notifications/notifications.api.service';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setActiveTeam } from '@/features/teams/teamSlice';
import { setUser } from '@/features/user/userSlice';
import { fetchInvitations, fetchNotifications } from '@/features/navbar/notificationSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { createAuthService } from '@/services/auth/auth.service';
import { ITeamInvitationViewModel } from '@/types/notifications/notifications.types';
import { IAcceptTeamInvite } from '@/types/teams/team.type';
import logger from '@/utils/errorLogger';
import { TFunction } from 'i18next';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, theme } from '@/shared/antd-imports';
import { TeamOutlined } from '@/shared/antd-imports';

interface InvitationItemProps {
  item: ITeamInvitationViewModel;
  isUnreadNotifications: boolean;
  t: TFunction;
}

const InvitationItem: React.FC<InvitationItemProps> = ({ item, isUnreadNotifications, t }) => {
  const [accepting, setAccepting] = useState(false);
  const [joining, setJoining] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const authService = createAuthService(navigate);

  const inProgress = () => accepting || joining;

  const acceptInvite = async () => {
    if (!item.team_member_id) return;

    try {
      setAccepting(true);
      const body: IAcceptTeamInvite = {
        team_member_id: item.team_member_id,
      };
      const res = await teamsApiService.acceptInvitation(body);
      setAccepting(false);
      if (res.done && res.body.id) {
        return res.body;
      }
    } catch (error) {
      logger.error('Error accepting invitation', error);
    }
    return null;
  };

  const handleVerifyAuth = async () => {
    const result = await dispatch(verifyAuthentication()).unwrap();
    if (result.authenticated) {
      const user = (result as any).data?.user || result.user;
      if (user) {
        dispatch(setUser(user));
        authService.setCurrentSession(user);
      }
    }
  };

  const acceptAndJoin = async () => {
    try {
      const res = await acceptInvite();
      if (res && res.id) {
        setJoining(true);
        await dispatch(setActiveTeam(res.id));
        await handleVerifyAuth();
        window.location.reload();
        setJoining(false);
      }
    } catch (error) {
      logger.error('Error accepting and joining invitation', error);
    } finally {
      setAccepting(false);
      setJoining(false);
    }
  };

  const markAsReadOnly = async () => {
    try {
      if (item.notification_id) {
        await notificationsApiService.updateNotification(item.notification_id);
      }
      await dispatch(fetchInvitations());
      await dispatch(fetchNotifications('Unread'));
    } catch (error) {
      logger.error('Error marking invitation as read', error);
    }
  };

  return (
    <div
      style={{
        backgroundColor: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: '14px 16px',
        marginBottom: '10px',
      }}
    >
      {/* Team icon + invitation message */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          marginBottom: isUnreadNotifications ? '12px' : 0,
        }}
      >
        <TeamOutlined
          style={{
            fontSize: '18px',
            color: token.colorPrimary,
            marginTop: '2px',
            flexShrink: 0,
          }}
        />
        <Typography.Text style={{ color: token.colorText, fontSize: '14px', lineHeight: '1.6' }}>
          You have been invited to work with{' '}
          <Typography.Text strong style={{ color: token.colorText }}>
            {item.team_name}
          </Typography.Text>
          .
        </Typography.Text>
      </div>

      {/* Action buttons */}
      {isUnreadNotifications && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            size="small"
            type="text"
            onClick={markAsReadOnly}
            disabled={inProgress()}
            style={{ color: token.colorTextSecondary, fontSize: '13px' }}
          >
            {accepting ? 'Loading...' : t('notificationsDrawer.markAsRead')}
          </Button>
          <Button
            size="small"
            type="primary"
            onClick={() => acceptAndJoin()}
            disabled={inProgress()}
            loading={joining}
          >
            {joining ? 'Joining...' : t('notificationsDrawer.readAndJoin')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default InvitationItem;

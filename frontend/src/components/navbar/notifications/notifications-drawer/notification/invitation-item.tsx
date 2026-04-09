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
      // Backend returns { authenticated, data: { user } } - extract user correctly
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
      style={{ width: 'auto' }}
      className="ant-notification-notice worklenz-notification rounded-4"
    >
      <div className="ant-notification-notice-content">
        <div className="ant-notification-notice-description">
          You have been invited to work with <b>{item.team_name}</b>.
        </div>
        {isUnreadNotifications && (
          <div
            className="mt-2"
            style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}
          >
            <button
              onClick={markAsReadOnly}
              disabled={inProgress()}
              className="p-0"
              style={{
                background: 'none',
                border: 'none',
                cursor: inProgress() ? 'not-allowed' : 'pointer',
              }}
            >
              {accepting ? 'Loading...' : <u>{t('notificationsDrawer.markAsRead')}</u>}
            </button>
            <button
              onClick={() => acceptAndJoin()}
              disabled={inProgress()}
              style={{
                background: 'none',
                border: 'none',
                cursor: inProgress() ? 'not-allowed' : 'pointer',
              }}
            >
              {joining ? 'Loading...' : <u>{t('notificationsDrawer.readAndJoin')}</u>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationItem;

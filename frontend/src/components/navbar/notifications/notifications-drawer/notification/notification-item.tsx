import { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { BankOutlined } from '@/shared/antd-imports';
import { Button, Typography, theme } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { fromNow } from '@/utils/dateUtils';
import './notification-item.css';

const { Text } = Typography;

interface NotificationItemProps {
  notification: IWorklenzNotification;
  isUnreadNotifications?: boolean;
  markNotificationAsRead?: (id: string) => Promise<void>;
  goToUrl?: (e: React.MouseEvent, notification: IWorklenzNotification) => Promise<void>;
}

const NotificationItem = ({
  notification,
  isUnreadNotifications = true,
  markNotificationAsRead,
  goToUrl,
}: NotificationItemProps) => {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);

  const handleNotificationClick = async (e: React.MouseEvent) => {
    const id = notification.id || (notification as any)._id;
    if (id) {
      await goToUrl?.(e, notification);
      await markNotificationAsRead?.(id);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = notification.id || (notification as any)._id;
    if (!id) return;

    setLoading(true);
    try {
      await markNotificationAsRead?.(id);
    } finally {
      setLoading(false);
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
        cursor: notification.url ? 'pointer' : 'default',
        transition: 'background 0.2s',
      }}
      onClick={handleNotificationClick}
    >
      {/* Team name row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px',
          color: token.colorTextTertiary,
          fontSize: '13px',
        }}
      >
        <BankOutlined style={{ fontSize: '14px' }} />
        <span>{notification.team || 'Worklenz'}</span>
      </div>

      {/* Message */}
      <div
        style={{
          marginBottom: '10px',
          fontSize: '14px',
          lineHeight: '1.6',
          color: token.colorText,
        }}
        dangerouslySetInnerHTML={{
          __html: (notification.message || '').replace(
            /\*\*(.*?)\*\*/g,
            `<strong style="color:${token.colorText};font-weight:600">$1</strong>`
          ),
        }}
      />

      {/* Project badge */}
      {(notification.project || (notification as any).meta?.project_name) && (
        <div
          style={{
            display: 'inline-block',
            backgroundColor: token.colorPrimaryBg,
            color: token.colorPrimaryText ?? token.colorPrimary,
            padding: '2px 10px',
            borderRadius: token.borderRadius,
            fontSize: '12px',
            marginBottom: '12px',
            border: `1px solid ${token.colorPrimaryBorder}`,
          }}
        >
          {notification.project || (notification as any).meta?.project_name}
        </div>
      )}

      {/* Footer: mark as read + timestamp */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '4px',
        }}
      >
        {isUnreadNotifications && markNotificationAsRead && (
          <Button
            loading={loading}
            type="link"
            size="small"
            className="p-0"
            style={{ color: token.colorPrimary, fontSize: '13px', padding: 0 }}
            onClick={e => handleMarkAsRead(e)}
          >
            Mark as read
          </Button>
        )}
        <Text
          style={{
            color: token.colorTextQuaternary,
            fontSize: '12px',
            marginLeft: 'auto',
          }}
        >
          {notification.created_at ? fromNow(notification.created_at) : 'a few seconds ago'}
        </Text>
      </div>
    </div>
  );
};

export default NotificationItem;

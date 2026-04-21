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
        backgroundColor: '#1f1f1f',
        border: '1px solid #4a1a4a',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '12px',
        cursor: notification.url ? 'pointer' : 'default',
        color: '#fff'
      }}
      onClick={handleNotificationClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#8c8c8c', fontSize: '14px' }}>
        <BankOutlined style={{ fontSize: '16px' }} />
        <span>{notification.team || 'Riyansh'}</span>
      </div>

      <div 
        style={{ 
          marginBottom: '12px', 
          fontSize: '15px', 
          lineHeight: '1.5',
          color: '#e8e8e8'
        }} 
        dangerouslySetInnerHTML={{ 
          __html: (notification.message || '')
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #fff">$1</strong>')
        }} 
      />

      {(notification.project || (notification as any).meta?.project_name) && (
        <div style={{ 
          display: 'inline-block',
          backgroundColor: '#2b213a',
          color: '#d3adf7',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          marginBottom: '16px'
        }}>
          {notification.project || (notification as any).meta?.project_name}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        {isUnreadNotifications && markNotificationAsRead && (
          <Button
            loading={loading}
            type="link"
            size="small"
            className="p-0"
            style={{ color: '#177ddc', fontSize: '14px', textDecoration: 'underline' }}
            onClick={e => handleMarkAsRead(e)}
          >
            Mark as read
          </Button>
        )}
        <Text style={{ color: '#595959', fontSize: '12px', marginLeft: 'auto' }}>
          {notification.created_at ? fromNow(notification.created_at) : 'a few seconds ago'}
        </Text>
      </div>
    </div>
  );
};

export default NotificationItem;

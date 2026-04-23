import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';

import { SOCKET_CONFIG } from './config';
import logger from '@/utils/errorLogger';
import { Modal, message, notification } from '@/shared/antd-imports';
import { SocketEvents } from '@/shared/socket-events';
import { getUserSession } from '@/utils/session-helper';

// Global socket instance to prevent multiple connections in StrictMode
let globalSocketInstance: Socket | null = null;

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  modalContextHolder: React.ReactElement<any>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation('common');

  // ✅ FIX: Use state for socket so consumers re-render when socket becomes available
  const [socket, setSocket] = useState<Socket | null>(globalSocketInstance);
  const [connected, setConnected] = useState(globalSocketInstance?.connected ?? false);

  const [modal, contextHolder] = Modal.useModal();
  const profile = getUserSession();
  const [messageApi, messageContextHolder] = message.useMessage();
  const hasShownConnectedMessage = useRef(false);
  const isInitialized = useRef(!!globalSocketInstance);
  const messageApiRef = useRef(messageApi);
  const tRef = useRef(t);

  useEffect(() => { messageApiRef.current = messageApi; }, [messageApi]);
  useEffect(() => { tRef.current = t; }, [t]);

  useEffect(() => {
    // Prevent duplicate initialization
    if (isInitialized.current && globalSocketInstance) {
      // Already have a socket — attach listeners and expose it
      const existingSocket = globalSocketInstance;
      setSocket(existingSocket);
      setConnected(existingSocket.connected);
      return;
    }

    isInitialized.current = true;

    // Get auth token for socket authentication
    const token = localStorage.getItem('worklenz_token');

    const newSocket = io(SOCKET_CONFIG.url, {
      ...SOCKET_CONFIG.options,
      path: '/socket.io',
      auth: { token: token || '' },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    globalSocketInstance = newSocket;

    // ✅ Expose socket to context consumers immediately (before connect event)
    setSocket(newSocket);

    newSocket.on('connect', () => {
      logger.info('Socket connected');
      setConnected(true);

      if (!hasShownConnectedMessage.current) {
        messageApiRef.current.success(tRef.current('connection-restored'));
        hasShownConnectedMessage.current = true;
      }
    });

    // Emit login event on connect
    if (profile && profile.id) {
      newSocket.emit(SocketEvents.LOGIN.toString(), profile.id);
      newSocket.once(SocketEvents.LOGIN.toString(), () => {
        logger.info('Socket login success');
      });
    }

    newSocket.on('connect_error', error => {
      console.error('❌ Socket connection failed:', error.message);
      logger.error('Connection error', { error });
      setConnected(false);
      messageApiRef.current.error(tRef.current('connection-lost'));
      hasShownConnectedMessage.current = false;
    });

    newSocket.on('disconnect', () => {
      logger.info('Socket disconnected');
      setConnected(false);
      messageApiRef.current.loading(tRef.current('reconnecting'));
      hasShownConnectedMessage.current = false;

      if (profile && profile.id) {
        newSocket.emit(SocketEvents.LOGOUT.toString(), profile.id);
      }
    });

    newSocket.on(SocketEvents.INVITATIONS_UPDATE.toString(), (msg: string) => {
      logger.info(msg);
    });

    newSocket.on(
      SocketEvents.TEAM_MEMBER_REMOVED.toString(),
      (data: { teamId: string; message: string }) => {
        if (!data) return;
        if (profile && profile.team_id === data.teamId) {
          modal.confirm({
            title: 'You no longer have permissions to stay on this team!',
            content: data.message,
            closable: false,
            cancelButtonProps: { disabled: true },
            onOk: () => window.location.reload(),
          });
        }
      }
    );

    newSocket.on(SocketEvents.NOTIFICATIONS_UPDATE.toString(), (data: any) => {
      if (data && data.message) {
        const senderName = data.meta?.sender_name || 'System';
        const messageText = data.message;
        const key = `notification_${Date.now()}`;

        notification.open({
          key,
          message: null,
          description: (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '4px 0', position: 'relative' }}>
              <div
                onClick={() => notification.destroy(key)}
                style={{ position: 'absolute', right: '-12px', top: '-10px', cursor: 'pointer', color: '#bfbfbf', fontSize: '18px', padding: '4px' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#595959'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#bfbfbf'}
              >
                ✕
              </div>
              <div style={{ backgroundColor: '#1890ff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>i</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: '#000', fontSize: '16px', fontWeight: 500 }}>
                  <span style={{ fontSize: '16px', color: '#1890ff' }}>🏛️</span>
                  <span>{senderName}</span>
                </div>
                <div style={{ color: '#595959', fontSize: '15px' }}>
                  <div dangerouslySetInnerHTML={{ __html: messageText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
              </div>
            </div>
          ),
          placement: 'topRight',
          duration: 10,
          style: { borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '16px 24px', width: '400px' }
        });
      }
    });

    // Connect
    newSocket.connect();

    return () => {
      newSocket.removeAllListeners();
      newSocket.close();
      globalSocketInstance = null;
      isInitialized.current = false;
      hasShownConnectedMessage.current = false;
      setSocket(null);
      setConnected(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    socket,        // ✅ Reactive state — consumers re-render when socket is ready
    connected,
    modalContextHolder: contextHolder,
  };

  return (
    <SocketContext.Provider value={value}>
      {messageContextHolder}
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

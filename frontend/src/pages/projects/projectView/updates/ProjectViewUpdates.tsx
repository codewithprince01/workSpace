import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Avatar, Input, Tooltip, Typography, Spin } from 'antd';
import { CheckOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useSocket } from '../../../../socket/socketContext';
import { getUserSession } from '../../../../utils/session-helper';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);

const { TextArea } = Input;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar: string | null;
  message: string;
  timestamp: string | Date;
  readBy: string[];
  pending?: boolean;
}

interface TypingUser {
  user_id: string;
  username: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

const COLORS = [
  '#5B8FF9','#61DDAA','#F6BD16','#E8684A','#9270CA',
  '#FF9D4D','#269A99','#FF99C3','#3AA1FF','#FAAD14',
];

const userColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
};

const formatTime = (ts: string | Date) => dayjs(ts).format('HH:mm');
const formatDate = (ts: string | Date) => {
  const d = dayjs(ts);
  if (d.isToday()) return 'Today';
  if (d.isYesterday()) return 'Yesterday';
  return d.format('MMM D, YYYY');
};

// ─── Sub-component: Tick/Read indicator ───────────────────────────────────────
const SeenStatus = ({ msg, currentUserId, memberCount }: {
  msg: ChatMessage;
  currentUserId: string;
  memberCount: number;
}) => {
  if (msg.user_id !== currentUserId) return null;
  const seenCount = (msg.readBy || []).filter(uid => uid !== currentUserId).length;
  const color = seenCount > 0 ? '#1890ff' : '#8c8c8c';
  const label = seenCount === 0
    ? 'Sent'
    : seenCount >= memberCount - 1
      ? 'Seen by everyone'
      : `Seen by ${seenCount}`;

  return (
    <Tooltip title={label}>
      <span style={{ fontSize: 11, color, marginLeft: 4, cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
        <CheckOutlined style={{ fontSize: 10 }} />
        {seenCount > 0 && <CheckOutlined style={{ fontSize: 10, marginLeft: -4 }} />}
      </span>
    </Tooltip>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectViewUpdates = () => {
  const { socket, connected } = useSocket();
  const { projectId } = useAppSelector(state => state.projectReducer);
  const profile = getUserSession();
  const currentUserId = profile?.id as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [memberCount, setMemberCount] = useState(2);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isNearBottom = useRef(true);
  const typingEmitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto scroll ────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((force = false) => {
    if (force || isNearBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !projectId || !connected) return;

    // Join project room and load history
    socket.emit('join:project', projectId);
    socket.emit('chat:history', { projectId, limit: 50 });
    socket.emit('chat:read', { projectId });

    const onHistory = (msgs: ChatMessage[]) => {
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => scrollToBottom(true), 50);
    };

    const onMessage = (msg: ChatMessage) => {
      setMessages(prev => {
        // Deduplicate
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Mark as read immediately
      socket.emit('chat:read', { projectId });
      setTimeout(() => scrollToBottom(), 50);
    };

    const onDeleted = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    const onTyping = ({ user_id, username, isTyping }: TypingUser & { isTyping: boolean }) => {
      if (user_id === currentUserId) return;
      if (isTyping) {
        setTypingUsers(prev => prev.some(u => u.user_id === user_id) ? prev : [...prev, { user_id, username }]);
        // Auto-clear after 4s
        const timeout = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
          typingTimeouts.current.delete(user_id);
        }, 4000);
        clearTimeout(typingTimeouts.current.get(user_id));
        typingTimeouts.current.set(user_id, timeout);
      } else {
        clearTimeout(typingTimeouts.current.get(user_id));
        typingTimeouts.current.delete(user_id);
        setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
      }
    };

    const onRead = () => {
      // Re-fetch to sync read receipts; lightweight approach
      setMessages(prev => [...prev]);
    };

    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMessage);
    socket.on('chat:deleted', onDeleted);
    socket.on('chat:typing', onTyping);
    socket.on('chat:read', onRead);

    return () => {
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
      socket.off('chat:deleted', onDeleted);
      socket.off('chat:typing', onTyping);
      socket.off('chat:read', onRead);
      typingTimeouts.current.forEach(t => clearTimeout(t));
      typingTimeouts.current.clear();
    };
  }, [socket, projectId, connected]);

  // ── Group messages by date + consecutive sender ─────────────────────────────
  const groupedMessages = useMemo(() => {
    const result: Array<{ dateLabel?: string; msg: ChatMessage; showHeader: boolean }> = [];
    let lastDate = '';
    let lastSender = '';

    for (const msg of messages) {
      const dateLabel = formatDate(msg.timestamp);
      const isNewDate = dateLabel !== lastDate;
      const isNewSender = msg.user_id !== lastSender;

      if (isNewDate) {
        lastDate = dateLabel;
        lastSender = '';
      }

      result.push({
        dateLabel: isNewDate ? dateLabel : undefined,
        msg,
        showHeader: isNewDate || isNewSender,
      });

      lastSender = msg.user_id;
    }

    return result;
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    if (!input.trim() || !socket || !projectId) return;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      user_id: currentUserId,
      username: profile?.name || 'You',
      avatar: profile?.avatar_url || null,
      message: input.trim(),
      timestamp: new Date().toISOString(),
      readBy: [currentUserId],
      pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setTimeout(() => scrollToBottom(true), 30);

    socket.emit('chat:send', { projectId, message: optimistic.message });
    socket.emit('chat:typing', { projectId, isTyping: false });
  }, [input, socket, projectId, currentUserId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!socket || !projectId) return;

    // Debounce typing emit
    if (typingEmitTimeout.current) clearTimeout(typingEmitTimeout.current);
    socket.emit('chat:typing', { projectId, isTyping: true });
    typingEmitTimeout.current = setTimeout(() => {
      socket.emit('chat:typing', { projectId, isTyping: false });
    }, 3000);
  };

  const deleteMessage = (msg: ChatMessage) => {
    if (!socket || !projectId || msg.user_id !== currentUserId) return;
    // Optimistic remove
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    socket.emit('chat:delete', { projectId, messageId: msg.id });
  };

  // ── Typing indicator text ───────────────────────────────────────────────────
  const typingText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].username} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);

  // ── Render messages ─────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 200px)',
      minHeight: 500,
      background: '#141414',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid #1f1f1f',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1f1f1f',
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#52c41a' : '#8c8c8c',
          boxShadow: connected ? '0 0 6px #52c41a' : 'none',
        }} />
        <Typography.Text style={{ color: '#e8e8e8', fontWeight: 600, fontSize: 14 }}>
          Project Chat
        </Typography.Text>
        <Typography.Text style={{ color: '#595959', fontSize: 12, marginLeft: 'auto' }}>
          {connected ? 'Live' : 'Connecting...'}
        </Typography.Text>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          scrollbarWidth: 'thin',
          scrollbarColor: '#2a2a2a #141414',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Spin size="large" />
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            flex: 1, gap: 12,
          }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <Typography.Text style={{ color: '#595959', fontSize: 14 }}>
              No messages yet. Start the conversation!
            </Typography.Text>
          </div>
        ) : (
          groupedMessages.map(({ dateLabel, msg, showHeader }) => {
            const isOwn = msg.user_id === currentUserId;

            return (
              <React.Fragment key={msg.id}>
                {/* Date divider */}
                {dateLabel && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    margin: '16px 0 8px',
                  }}>
                    <div style={{ flex: 1, height: '1px', background: '#1f1f1f' }} />
                    <Typography.Text style={{
                      color: '#434343', fontSize: 11, whiteSpace: 'nowrap',
                      padding: '2px 10px', background: '#1a1a1a',
                      borderRadius: 99, border: '1px solid #1f1f1f',
                    }}>
                      {dateLabel}
                    </Typography.Text>
                    <div style={{ flex: 1, height: '1px', background: '#1f1f1f' }} />
                  </div>
                )}

                {/* Message row */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: isOwn ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    gap: 8,
                    marginBottom: showHeader ? 12 : 3,
                    marginTop: showHeader && !dateLabel ? 8 : 0,
                  }}
                  className="chat-msg-row"
                >
                  {/* Avatar (other users only) */}
                  {!isOwn && (
                    <div style={{ width: 32, flexShrink: 0 }}>
                      {showHeader && (
                        <Avatar
                          size={32}
                          src={msg.avatar}
                          style={{
                            background: userColor(msg.user_id),
                            fontSize: 12, fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {!msg.avatar && getInitials(msg.username)}
                        </Avatar>
                      )}
                    </div>
                  )}

                  {/* Bubble */}
                  <div style={{ maxWidth: '68%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    {/* Username + time */}
                    {showHeader && (
                      <div style={{
                        display: 'flex', alignItems: 'baseline', gap: 8,
                        marginBottom: 3, flexDirection: isOwn ? 'row-reverse' : 'row',
                      }}>
                        {!isOwn && (
                          <Typography.Text style={{
                            color: userColor(msg.user_id),
                            fontSize: 12, fontWeight: 600,
                          }}>
                            {msg.username}
                          </Typography.Text>
                        )}
                        <Typography.Text style={{ color: '#434343', fontSize: 11 }}>
                          {formatTime(msg.timestamp)}
                        </Typography.Text>
                      </div>
                    )}

                    {/* Bubble wrapper with hover delete */}
                    <div
                      style={{ position: 'relative', display: 'inline-block' }}
                      className="bubble-wrapper"
                    >
                      <div style={{
                        padding: '8px 14px',
                        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: isOwn
                          ? 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)'
                          : '#1f1f1f',
                        color: isOwn ? '#fff' : '#d9d9d9',
                        fontSize: 14,
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        boxShadow: isOwn
                          ? '0 2px 8px rgba(22, 119, 255, 0.25)'
                          : '0 1px 4px rgba(0,0,0,0.2)',
                        opacity: msg.pending ? 0.6 : 1,
                      }}>
                        {msg.message}
                      </div>

                      {/* Hover delete (own messages) */}
                      {isOwn && !msg.pending && (
                        <button
                          onClick={() => deleteMessage(msg)}
                          className="msg-delete-btn"
                          title="Delete"
                          style={{
                            position: 'absolute',
                            top: '50%', left: -34,
                            transform: 'translateY(-50%)',
                            background: '#2a2a2a',
                            border: '1px solid #333',
                            borderRadius: 6,
                            padding: '3px 6px',
                            cursor: 'pointer',
                            color: '#ff4d4f',
                            display: 'none',
                          }}
                        >
                          <DeleteOutlined style={{ fontSize: 11 }} />
                        </button>
                      )}
                    </div>

                    {/* Timestamp (non-header) + seen status */}
                    {!showHeader && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                        <Typography.Text style={{ color: '#3a3a3a', fontSize: 10 }}>
                          {formatTime(msg.timestamp)}
                        </Typography.Text>
                        <SeenStatus msg={msg} currentUserId={currentUserId} memberCount={memberCount} />
                      </div>
                    )}
                    {showHeader && (
                      <div style={{ marginTop: 2 }}>
                        <SeenStatus msg={msg} currentUserId={currentUserId} memberCount={memberCount} />
                      </div>
                    )}
                  </div>

                  {/* Own messages spacer (no avatar shown) */}
                  {isOwn && <div style={{ width: 32 }} />}
                </div>
              </React.Fragment>
            );
          })
        )}

        {/* Typing indicator */}
        {typingText && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '4px 8px', marginBottom: 4,
          }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#1677ff',
                  animation: `bounce 1.2s ${i * 0.15}s ease-in-out infinite`,
                }} />
              ))}
            </div>
            <Typography.Text style={{ color: '#595959', fontSize: 12, fontStyle: 'italic' }}>
              {typingText}
            </Typography.Text>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1f1f1f',
        background: '#1a1a1a',
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <TextArea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            autoSize={{ minRows: 1, maxRows: 5 }}
            maxLength={2000}
            disabled={!connected}
            style={{
              background: '#141414',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              color: '#e8e8e8',
              resize: 'none',
              paddingRight: 48,
              fontSize: 14,
            }}
          />
          <span style={{
            position: 'absolute', bottom: 6, right: 12,
            color: '#434343', fontSize: 11, pointerEvents: 'none',
          }}>
            {input.length > 0 && `${input.length}/2000`}
          </span>
        </div>
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !connected}
          style={{
            background: input.trim() && connected
              ? 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)'
              : '#1f1f1f',
            border: 'none',
            borderRadius: 12,
            width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() && connected ? 'pointer' : 'not-allowed',
            flexShrink: 0,
            transition: 'all 0.2s ease',
            color: input.trim() && connected ? '#fff' : '#434343',
          }}
        >
          <SendOutlined style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Inline CSS for hover/animation */}
      <style>{`
        .bubble-wrapper:hover .msg-delete-btn { display: block !important; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        .chat-msg-row { transition: opacity 0.15s; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 99px; }
      `}</style>
    </div>
  );
};

export default ProjectViewUpdates;

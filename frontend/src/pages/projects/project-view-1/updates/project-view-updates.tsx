import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Avatar, Input, Tooltip, Typography, Spin } from 'antd';
import { CheckOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { getUserSession } from '@/utils/session-helper';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

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

const AVATAR_COLORS = [
  '#5B8FF9', '#61DDAA', '#F6BD16', '#E8684A', '#9270CA',
  '#FF9D4D', '#269A99', '#FF99C3', '#3AA1FF', '#FAAD14',
];

const getUserColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const formatTime = (ts: string | Date) => dayjs(ts).format('HH:mm');

const formatDateLabel = (ts: string | Date) => {
  const d = dayjs(ts);
  const today = dayjs();
  if (d.format('YYYY-MM-DD') === today.format('YYYY-MM-DD')) return 'Today';
  if (d.format('YYYY-MM-DD') === today.subtract(1, 'day').format('YYYY-MM-DD')) return 'Yesterday';
  return d.format('MMM D, YYYY');
};

// ─── Read-Receipt Ticks ───────────────────────────────────────────────────────
const SeenStatus = ({ msg, currentUserId, memberCount }: {
  msg: ChatMessage;
  currentUserId: string;
  memberCount: number;
}) => {
  if (msg.user_id !== currentUserId) return null;
  const isRead = (msg.readBy || []).some(uid => uid !== currentUserId);
  const color = isRead ? '#1890ff' : '#8c8c8c';
  const label = isRead ? 'Seen' : 'Sent';

  return (
    <Tooltip title={label}>
      <span style={{ fontSize: 10, color, marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 0 }}>
        <CheckOutlined style={{ fontSize: 9 }} />
        {isRead && <CheckOutlined style={{ fontSize: 9, marginLeft: -3 }} />}
      </span>
    </Tooltip>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectViewUpdates = () => {
  const { socket, connected } = useSocket();

  // Get projectId from BOTH Redux and URL params (fallback)
  const reduxProjectId = useAppSelector(state => state.projectReducer.projectId);
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const projectId = reduxProjectId || urlProjectId;

  const profile = getUserSession();
  // Robust ID detection: backend might send _id or id
  const currentUserId = (profile?.id || profile?._id || '') as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // ... (rest of state)
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [memberCount] = useState(10); // approximate; used for "seen by everyone" threshold

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isNearBottom = useRef(true);
  const typingEmitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasJoined = useRef(false);

  // ── Scroll helpers ──────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((force = false) => {
    if (force || isNearBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  // ── Socket events ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !projectId) return;

    // Ensure we join the project room (project-view also joins it, belt-and-suspenders)
    if (!hasJoined.current || !connected) {
      socket.emit('join:project', projectId);
      hasJoined.current = true;
    }

    // Load message history
    setLoading(true);
    socket.emit('chat:history', { projectId, limit: 50 });

    // Mark messages as read when opening
    socket.emit('chat:read', { projectId });

    const onHistory = (msgs: ChatMessage[]) => {
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => scrollToBottom(true), 60);
    };

    const onMessage = (msg: ChatMessage) => {
      setMessages(prev => {
        // Remove matching optimistic (pending) message, then add confirmed one.
        // Match by content + sender to be safe against ID format mismatches.
        const withoutOptimistic = prev.filter(m => 
          !(m.pending && m.message.trim() === msg.message.trim() && m.user_id === msg.user_id)
        );
        
        // Prevent duplicate server messages
        if (withoutOptimistic.some(m => m.id === msg.id)) return withoutOptimistic;
        
        return [...withoutOptimistic, msg];
      });
      socket.emit('chat:read', { projectId });
      setTimeout(() => scrollToBottom(), 60);
    };

    const onDeleted = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    const onTyping = ({ user_id, username, isTyping }: TypingUser & { isTyping: boolean }) => {
      if (user_id === currentUserId) return;
      if (isTyping) {
        setTypingUsers(prev =>
          prev.some(u => u.user_id === user_id) ? prev : [...prev, { user_id, username }]
        );
        // Auto-clear after 4s if stop signal never comes
        const prev = typingTimeouts.current.get(user_id);
        if (prev) clearTimeout(prev);
        const timeout = setTimeout(() => {
          setTypingUsers(p => p.filter(u => u.user_id !== user_id));
          typingTimeouts.current.delete(user_id);
        }, 4000);
        typingTimeouts.current.set(user_id, timeout);
      } else {
        const prev = typingTimeouts.current.get(user_id);
        if (prev) clearTimeout(prev);
        typingTimeouts.current.delete(user_id);
        setTypingUsers(p => p.filter(u => u.user_id !== user_id));
      }
    };

    const onRead = ({ user_id }: { user_id: string }) => {
      if (user_id === currentUserId) return;
      setMessages(prev => prev.map(m => {
        if (!m.readBy.includes(user_id)) {
          return { ...m, readBy: [...m.readBy, user_id] };
        }
        return m;
      }));
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

  // ── Reset when switching projects ───────────────────────────────────────────
  useEffect(() => {
    setMessages([]);
    setLoading(true);
    hasJoined.current = false;
  }, [projectId]);

  // ── Group messages by date and consecutive sender ───────────────────────────
  const groupedMessages = useMemo(() => {
    const result: Array<{ dateLabel?: string; msg: ChatMessage; showHeader: boolean }> = [];
    let lastDate = '';
    let lastSender = '';

    for (const msg of messages) {
      const dateLabel = formatDateLabel(msg.timestamp);
      const isNewDate = dateLabel !== lastDate;
      const isNewSender = msg.user_id !== lastSender;

      if (isNewDate) { lastDate = dateLabel; lastSender = ''; }

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
    const text = input.trim();
    if (!text || !socket || !projectId) return;

    // Optimistic update
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      user_id: currentUserId,
      username: profile?.name || 'You',
      avatar: profile?.avatar_url || null,
      message: text,
      timestamp: new Date().toISOString(),
      readBy: [currentUserId],
      pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setTimeout(() => scrollToBottom(true), 30);

    // Clear typing indicator
    if (typingEmitTimeout.current) clearTimeout(typingEmitTimeout.current);
    socket.emit('chat:typing', { projectId, isTyping: false });

    // Send to server
    socket.emit('chat:send', { projectId, message: text });
  }, [input, socket, projectId, currentUserId, profile]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!socket || !projectId) return;
    if (typingEmitTimeout.current) clearTimeout(typingEmitTimeout.current);
    socket.emit('chat:typing', { projectId, isTyping: true });
    typingEmitTimeout.current = setTimeout(() => {
      socket.emit('chat:typing', { projectId, isTyping: false });
    }, 3000);
  };

  const deleteMessage = (msg: ChatMessage) => {
    if (!socket || !projectId || msg.user_id !== currentUserId || msg.pending) return;
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    socket.emit('chat:delete', { projectId, messageId: msg.id });
  };

  // ── Typing text ─────────────────────────────────────────────────────────────
  const typingText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].username} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 180px)',
      minHeight: 500,
      background: '#141414',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid #1f1f1f',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #1f1f1f',
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#52c41a' : '#595959',
          boxShadow: connected ? '0 0 6px #52c41a80' : 'none',
          transition: 'all 0.3s',
        }} />
        <Typography.Text style={{ color: '#d9d9d9', fontWeight: 600, fontSize: 14 }}>
          Project Chat
        </Typography.Text>
        <Typography.Text style={{ color: '#434343', fontSize: 11, marginLeft: 'auto' }}>
          {connected ? 'Live' : 'Reconnecting...'}
        </Typography.Text>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 16px 8px',
          display: 'flex',
          flexDirection: 'column',
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
            flex: 1, gap: 12, opacity: 0.5,
          }}>
            <div style={{ fontSize: 36 }}>💬</div>
            <Typography.Text style={{ color: '#595959', fontSize: 13 }}>
              No messages yet. Be the first!
            </Typography.Text>
          </div>
        ) : (
          <>
            {groupedMessages.map(({ dateLabel, msg, showHeader }) => {
              const isOwn = msg.user_id === currentUserId;
              return (
                <React.Fragment key={msg.id}>
                  {/* Date divider */}
                  {dateLabel && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      margin: '14px 0 8px',
                    }}>
                      <div style={{ flex: 1, height: 1, background: '#262626' }} />
                      <span style={{
                        color: '#434343', fontSize: 11, padding: '2px 10px',
                        background: '#1a1a1a', borderRadius: 99, border: '1px solid #262626',
                        whiteSpace: 'nowrap',
                      }}>
                        {dateLabel}
                      </span>
                      <div style={{ flex: 1, height: 1, background: '#262626' }} />
                    </div>
                  )}

                  {/* Message row */}
                  <div
                    className="chat-row"
                    style={{
                      display: 'flex',
                      flexDirection: isOwn ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: 8,
                      marginBottom: 3,
                      marginTop: showHeader && !dateLabel ? 10 : 0,
                    }}
                  >
                    {/* Avatar placeholder / avatar */}
                    <div style={{ width: 30, flexShrink: 0 }}>
                      {!isOwn && showHeader && (
                        <Avatar
                          size={30}
                          src={msg.avatar || undefined}
                          style={{ background: getUserColor(msg.user_id), fontSize: 11, fontWeight: 700 }}
                        >
                          {!msg.avatar && getInitials(msg.username)}
                        </Avatar>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{
                      maxWidth: '65%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isOwn ? 'flex-end' : 'flex-start',
                    }}>
                      {/* Name + time */}
                      {showHeader && (
                        <div style={{
                          display: 'flex', alignItems: 'baseline',
                          gap: 6, marginBottom: 3,
                          flexDirection: isOwn ? 'row-reverse' : 'row',
                        }}>
                          {!isOwn && (
                            <span style={{
                              color: getUserColor(msg.user_id),
                              fontSize: 12, fontWeight: 600,
                            }}>
                              {msg.username}
                            </span>
                          )}
                          <span style={{ color: '#434343', fontSize: 11 }}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      )}

                      {/* Bubble + delete */}
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {/* Delete button (own, on left of bubble) */}
                        {isOwn && !msg.pending && (
                          <button
                            onClick={() => deleteMessage(msg)}
                            title="Delete"
                            className="msg-delete"
                            style={{
                              background: 'transparent', border: 'none',
                              cursor: 'pointer', color: '#ff4d4f',
                              padding: '2px 4px', borderRadius: 4,
                              opacity: 0, transition: 'opacity 0.15s',
                              fontSize: 11,
                            }}
                          >
                            <DeleteOutlined />
                          </button>
                        )}

                        <div style={{
                          padding: '7px 13px',
                          borderRadius: isOwn ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                          background: isOwn
                            ? 'linear-gradient(135deg, #1677ff, #0958d9)'
                            : '#1f1f1f',
                          color: isOwn ? '#fff' : '#d9d9d9',
                          fontSize: 14, lineHeight: 1.5,
                          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                          boxShadow: isOwn
                            ? '0 2px 6px rgba(22,119,255,0.3)'
                            : '0 1px 3px rgba(0,0,0,0.25)',
                          opacity: msg.pending ? 0.55 : 1,
                          transition: 'opacity 0.2s',
                        }}>
                          {msg.message}
                        </div>
                      </div>

                      {/* Timestamp for grouped messages + seen */}
                      {!showHeader && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                          <span style={{ color: '#303030', fontSize: 10 }}>
                            {formatTime(msg.timestamp)}
                          </span>
                          <SeenStatus msg={msg} currentUserId={currentUserId} memberCount={memberCount} />
                        </div>
                      )}
                      {showHeader && <SeenStatus msg={msg} currentUserId={currentUserId} memberCount={memberCount} />}
                    </div>

                    {/* Spacer for own side */}
                    {isOwn && <div style={{ width: 30 }} />}
                  </div>
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* Typing indicator */}
        {typingText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className={`typing-dot dot-${i}`} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#1677ff',
                }} />
              ))}
            </div>
            <span style={{ color: '#595959', fontSize: 12, fontStyle: 'italic' }}>{typingText}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid #1f1f1f',
        background: '#1a1a1a',
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <TextArea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter ↵ sends, Shift+Enter for new line)"
            autoSize={{ minRows: 1, maxRows: 5 }}
            maxLength={2000}
            disabled={!connected}
            style={{
              background: '#141414',
              border: '1px solid #262626',
              borderRadius: 12, color: '#d9d9d9',
              resize: 'none', fontSize: 14,
              transition: 'border-color 0.2s',
            }}
          />
          {input.length > 0 && (
            <span style={{
              position: 'absolute', bottom: 6, right: 10,
              color: '#303030', fontSize: 10, pointerEvents: 'none',
            }}>
              {input.length}/2000
            </span>
          )}
        </div>

        <button
          onClick={sendMessage}
          disabled={!input.trim() || !connected}
          style={{
            background: input.trim() && connected
              ? 'linear-gradient(135deg, #1677ff, #0958d9)'
              : '#1f1f1f',
            border: 'none', borderRadius: 12,
            width: 40, height: 40, minWidth: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() && connected ? 'pointer' : 'not-allowed',
            color: input.trim() && connected ? '#fff' : '#434343',
            transition: 'all 0.2s', flexShrink: 0,
            boxShadow: input.trim() && connected ? '0 2px 8px rgba(22,119,255,0.4)' : 'none',
          }}
        >
          <SendOutlined style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        .chat-row:hover .msg-delete { opacity: 1 !important; }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        .typing-dot { animation: typingBounce 1.2s ease-in-out infinite; }
        .dot-0 { animation-delay: 0s; }
        .dot-1 { animation-delay: 0.15s; }
        .dot-2 { animation-delay: 0.30s; }
        div[style*="overflow-y: auto"]::-webkit-scrollbar { width: 5px; }
        div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 99px; }
      `}</style>
    </div>
  );
};

export default ProjectViewUpdates;

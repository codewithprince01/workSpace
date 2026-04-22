import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Avatar, Input, Tooltip, Typography, Spin, Popover, Button, Modal } from 'antd';
import { CheckOutlined, DeleteOutlined, SendOutlined, SmileOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { getUserSession } from '@/utils/session-helper';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { themeWiseColor } from '@/utils/themeWiseColor';

dayjs.extend(relativeTime);

const { TextArea } = Input;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatReaction {
  emoji: string;
  users: { user_id: string; name: string }[];
}

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar: string | null;
  message: string;
  timestamp: string | Date;
  readBy: { user_id: string; name: string; avatar?: string | null; read_at: string }[];
  reactions?: ChatReaction[];
  isDeleted?: boolean;
  hiddenFor?: string[]; // user IDs who have hidden this message
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
    .filter(Boolean)
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

// ─── Reaction Components ──────────────────────────────────────────────────────
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const ReactionDisplay = ({ 
  reactions, 
  currentUserId, 
  onToggle,
  themeMode
}: { 
  reactions: ChatReaction[]; 
  currentUserId: string;
  onToggle: (emoji: string, alreadyReacted: boolean) => void;
  themeMode: any;
}) => {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {reactions.map(r => {
        const isSelected = r.users.some(u => u.user_id === currentUserId);
        const nameList = r.users.map(u => u.name).join(', ');
        
        return (
          <Tooltip key={r.emoji} title={`${nameList} reacted with ${r.emoji}`}>
            <div
              onClick={() => onToggle(r.emoji, isSelected)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                background: isSelected ? '#1677ff20' : themeWiseColor('#f5f5f5', '#1f1f1f', themeMode),
                border: `1px solid ${isSelected ? '#1677ff' : themeWiseColor('#d9d9d9', '#303030', themeMode)}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                transition: 'all 0.2s',
              }}
            >
              <span>{r.emoji}</span>
              <span style={{ color: isSelected ? '#1677ff' : themeWiseColor('#8c8c8c', '#8c8c8c', themeMode), fontWeight: 600 }}>{r.users.length}</span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
};

const ReactionActions = ({ onSelect, themeMode }: { onSelect: (emoji: string) => void; themeMode: any }) => (
  <div style={{ 
    display: 'flex', 
    gap: 8, 
    padding: '4px 8px', 
    background: themeWiseColor('#ffffff', '#1a1a1a', themeMode), 
    borderRadius: 8, 
    border: `1px solid ${themeWiseColor('#d9d9d9', '#303030', themeMode)}`, 
    boxShadow: themeWiseColor('0 4px 12px rgba(0,0,0,0.1)', '0 4px 12px rgba(0,0,0,0.5)', themeMode) 
  }}>
    {QUICK_REACTIONS.map(emoji => (
      <span
        key={emoji}
        onClick={() => onSelect(emoji)}
        style={{ fontSize: 18, cursor: 'pointer', transition: 'transform 0.1s' }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {emoji}
      </span>
    ))}
  </div>
);

const SeenStatus = ({ msg, currentUserId }: {
  msg: ChatMessage;
  currentUserId: string;
}) => {
  if (msg.user_id !== currentUserId || msg.isDeleted) return null;
  const readers = (msg.readBy || []).filter(r => r.user_id !== currentUserId);
  
  if (readers.length === 0) {
    return (
      <Tooltip title="Sent">
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
          <CheckOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
        </div>
      </Tooltip>
    );
  }

  const names = readers.map(r => r.name).join(', ');
  const label = readers.length > 2 
    ? `Seen by ${readers.length} people` 
    : `Seen by ${readers.map(r => r.name).join(', ')}`;

  return (
    <Tooltip title={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {readers.map(r => (
          <div key={r.user_id} style={{ fontSize: 11 }}>{r.name} • {dayjs(r.read_at).format('HH:mm')}</div>
        ))}
      </div>
    }>
      <span style={{ fontSize: 10, color: '#1890ff', marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'help' }}>
        <div style={{ display: 'flex' }}>
          <CheckOutlined style={{ fontSize: 12 }} />
          <CheckOutlined style={{ fontSize: 12, marginLeft: -8 }} />
        </div>
        <span style={{ opacity: 0.8 }}>{label}</span>
      </span>
    </Tooltip>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectViewUpdates = () => {
  const { socket, connected } = useSocket();

  // Get projectId from BOTH Redux and URL params (fallback)
  const reduxProjectId = useAppSelector(state => state.projectReducer.projectId);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const projectId = reduxProjectId || urlProjectId;

  const profile = getUserSession();
  // Robust ID detection: backend might send _id or id
  const currentUserId = (profile?.id || profile?._id || '') as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<any>(null);
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isNearBottom = useRef(true);
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
    isNearBottom.current = (el.scrollHeight - el.scrollTop - el.clientHeight) < 100;
  }, []);

  // ── Socket events ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !projectId) return;

    if (!hasJoined.current || !connected) {
      socket.emit('join:project', projectId);
      hasJoined.current = true;
    }

    setLoading(true);
    socket.emit('chat:history', { projectId, limit: 50 });
    socket.emit('message_read', { projectId });

    const onHistory = (msgs: ChatMessage[]) => {
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => scrollToBottom(true), 60);
    };

    const onMessage = (msg: ChatMessage) => {
      setMessages(prev => {
        const withoutOptimistic = prev.filter(m => 
          !(m.pending && m.message.trim() === msg.message.trim() && m.user_id === msg.user_id)
        );
        if (withoutOptimistic.some(m => m.id === msg.id)) return withoutOptimistic;
        return [...withoutOptimistic, msg];
      });
      socket.emit('message_read', { projectId });
      setTimeout(() => scrollToBottom(), 60);
    };

    const onMessageDeleted = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, isDeleted: true, message: 'This message was deleted' } : m
      ));
    };

    const onTypingStart = ({ user_id, username }: TypingUser) => {
      if (user_id === currentUserId) return;
      setTypingUsers(prev => prev.some(u => u.user_id === user_id) ? prev : [...prev, { user_id, username }]);
      
      const existing = typingTimeouts.current.get(user_id);
      if (existing) clearTimeout(existing);
      
      const timeout = setTimeout(() => {
        setTypingUsers(p => p.filter(u => u.user_id !== user_id));
        typingTimeouts.current.delete(user_id);
      }, 4000);
      typingTimeouts.current.set(user_id, timeout);
    };

    const onTypingStop = ({ user_id }: { user_id: string }) => {
      setTypingUsers(p => p.filter(u => u.user_id !== user_id));
      const existing = typingTimeouts.current.get(user_id);
      if (existing) clearTimeout(existing);
      typingTimeouts.current.delete(user_id);
    };

    const onMessageRead = ({ user_id, username }: { user_id: string; username: string }) => {
      if (user_id === currentUserId) return;
      setMessages(prev => prev.map(m => {
        const isAlreadyRead = m.readBy.some(r => r.user_id === user_id);
        if (!isAlreadyRead) {
          return { ...m, readBy: [...m.readBy, { user_id, name: username }] };
        }
        return m;
      }));
    };

    const onReactionUpdated = ({ messageId, reactions }: { messageId: string; reactions: ChatReaction[] }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    };

    const onMessageHidden = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, hiddenFor: [...(m.hiddenFor || []), currentUserId] } 
          : m
      ));
    };

    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMessage);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);
    socket.on('message_read', onMessageRead);
    socket.on('message_reaction_updated', onReactionUpdated);
    socket.on('message_hidden', onMessageHidden);

    return () => {
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
      socket.off('message_read', onMessageRead);
      socket.off('message_reaction_updated', onReactionUpdated);
      socket.off('message_hidden', onMessageHidden);
      typingTimeouts.current.forEach(t => clearTimeout(t));
      typingTimeouts.current.clear();
    };
  }, [socket, projectId, connected, currentUserId]);

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
      if (msg.isDeleted) continue; // Hide all placeholders globally for a clean chat
      if (msg.hiddenFor?.includes(String(currentUserId))) continue;
      
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
      readBy: [{ user_id: currentUserId, name: profile?.name || 'You' }],
      pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setTimeout(() => scrollToBottom(true), 30);

    // Stop typing indicator on send
    if (isTyping) {
      socket.emit('typing_stop', { projectId });
      setIsTyping(false);
    }

    // Send to server
    socket.emit('chat:send', { projectId, message: text });
  }, [input, socket, projectId, currentUserId, profile, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Ref-based debounce for typing_stop
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInputWithDebounce = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!socket || !projectId) return;

    if (!isTyping) {
      socket.emit('typing_start', { projectId });
      setIsTyping(true);
    }

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { projectId });
      setIsTyping(false);
    }, 2500);
  };

  const deleteMessage = (msg: ChatMessage) => {
    if (!socket || !projectId || msg.pending) return;
    setMessageToDelete(msg);
    setDeleteModalVisible(true);
  };

  const handleDeleteFinal = (type: 'me' | 'everyone') => {
    if (!socket || !projectId || !messageToDelete) return;
    
    // Safety check: only sender can delete for everyone
    if (type === 'everyone' && String(messageToDelete.user_id) !== currentUserId) {
      return;
    }

    socket.emit('chat:delete', { projectId, messageId: messageToDelete.id, type });
    setDeleteModalVisible(false);
    setMessageToDelete(null);
  };

  const handleReactionToggle = (messageId: string, emoji: string, alreadyReacted: boolean) => {
    if (!socket || !projectId) return;
    socket.emit(alreadyReacted ? 'remove_reaction' : 'add_reaction', { projectId, messageId, emoji });
  };

  const onEmojiSelect = (emojiData: any) => {
    const emoji = emojiData.native;
    const textArea = textAreaRef.current?.resizableTextArea?.textArea;
    if (!textArea) {
      setInput(prev => prev + emoji);
      return;
    }

    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const text = input;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    setInput(before + emoji + after);

    // Maintain focus and set cursor after the new emoji
    setTimeout(() => {
      if (textAreaRef.current?.resizableTextArea?.textArea) {
        const textArea = textAreaRef.current.resizableTextArea.textArea;
        textArea.focus();
        const newPos = start + emoji.length;
        textArea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // ── Typing text ─────────────────────────────────────────────────────────────
  const typingText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].username} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
    return `${typingUsers[0].username} and ${typingUsers.length - 1} others are typing...`;
  }, [typingUsers]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 180px)',
      minHeight: 500,
      background: themeWiseColor('#ffffff', '#141414', themeMode),
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid ${themeWiseColor('#f0f0f0', '#1f1f1f', themeMode)}`,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#1f1f1f', themeMode)}`,
        background: themeWiseColor('#fafafa', '#1a1a1a', themeMode),
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#52c41a' : '#8c8c8c',
          boxShadow: connected ? '0 0 6px #52c41a80' : 'none',
          transition: 'all 0.3s',
        }} />
        <Typography.Text style={{ color: themeWiseColor('#262626', '#d9d9d9', themeMode), fontWeight: 600, fontSize: 14 }}>
          Project Chat
        </Typography.Text>
        <Typography.Text style={{ color: themeWiseColor('#8c8c8c', '#434343', themeMode), fontSize: 11, marginLeft: 'auto' }}>
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
            <Typography.Text style={{ color: themeWiseColor('#8c8c8c', '#595959', themeMode), fontSize: 13 }}>
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
                      <div style={{ flex: 1, height: 1, background: themeWiseColor('#f0f0f0', '#262626', themeMode) }} />
                      <span style={{
                        color: themeWiseColor('#8c8c8c', '#434343', themeMode), fontSize: 11, padding: '2px 10px',
                        background: themeWiseColor('#fafafa', '#1a1a1a', themeMode), borderRadius: 99, border: `1px solid ${themeWiseColor('#f0f0f0', '#262626', themeMode)}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {dateLabel}
                      </span>
                      <div style={{ flex: 1, height: 1, background: themeWiseColor('#f0f0f0', '#262626', themeMode) }} />
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
                          <span style={{ color: themeWiseColor('#bfbfbf', '#434343', themeMode), fontSize: 11 }}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      )}

                      {/* Bubble + actions */}
                      <div 
                        className="msg-wrapper"
                        style={{ 
                          position: 'relative', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 4,
                          flexDirection: isOwn ? 'row-reverse' : 'row' // My messages: Icon-Bubble, Others: Bubble-Icon
                        }}
                      >
                        <div style={{
                          padding: '7px 13px',
                          borderRadius: isOwn ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                          background: msg.isDeleted || msg.message === 'This message was deleted'
                            ? themeWiseColor('#f5f5f5', '#262626', themeMode) // Always neutral grey for deleted
                            : (isOwn ? 'linear-gradient(135deg, #1677ff, #0958d9)' : themeWiseColor('#f0f0f0', '#1f1f1f', themeMode)),
                          color: (msg.isDeleted || msg.message === 'This message was deleted') ? '#8c8c8c' : (isOwn ? '#fff' : themeWiseColor('#262626', '#d9d9d9', themeMode)),
                          fontSize: 14, lineHeight: 1.5,
                          fontStyle: (msg.isDeleted || msg.message === 'This message was deleted') ? 'italic' : 'normal',
                          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                          boxShadow: (msg.isDeleted || msg.message === 'This message was deleted')
                            ? 'none' 
                            : (isOwn ? '0 2px 6px rgba(22,119,255,0.3)' : 'none'),
                          opacity: msg.pending ? 0.55 : 1,
                          transition: 'all 0.2s',
                          border: msg.isDeleted ? `1px solid ${themeWiseColor('#d9d9d9', '#303030', themeMode)}` : 'none',
                        }}>
                          {msg.message}
                        </div>

                        {/* Actions */}
                        {!msg.pending && (
                          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            {/* Remove/Delete button (For everyone) */}
                            <button
                              onClick={() => deleteMessage(msg)}
                              title={msg.isDeleted ? 'Remove from chat' : 'Delete options'}
                              className="chat-action-btn"
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

                            {/* Reaction button (ONLY for non-deleted) */}
                            {!msg.isDeleted && (
                              <Popover
                                content={<ReactionActions themeMode={themeMode} onSelect={(emoji) => handleReactionToggle(msg.id, emoji, false)} />}
                                trigger="click"
                                placement="top"
                                overlayInnerStyle={{ padding: 0 }}
                                getPopupContainer={(trigger) => trigger.parentElement || document.body}
                              >
                                <button
                                  className="chat-action-btn"
                                  style={{
                                    background: 'transparent', border: 'none',
                                    cursor: 'pointer', color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode),
                                    padding: '2px 4px', borderRadius: 4,
                                    opacity: 0, transition: 'opacity 0.15s',
                                    fontSize: 13,
                                  }}
                                >
                                  <SmileOutlined />
                                </button>
                              </Popover>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reactions List */}
                      {!msg.isDeleted && msg.reactions && (
                        <ReactionDisplay 
                          reactions={msg.reactions} 
                          currentUserId={currentUserId} 
                          onToggle={(emoji, alreadyReacted) => handleReactionToggle(msg.id, emoji, alreadyReacted)} 
                          themeMode={themeMode}
                        />
                      )}

                      {/* Timestamp for grouped messages + seen */}
                      {!showHeader && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                          <span style={{ color: themeWiseColor('#bfbfbf', '#303030', themeMode), fontSize: 10 }}>
                            {formatTime(msg.timestamp)}
                          </span>
                          <SeenStatus msg={msg} currentUserId={currentUserId} />
                        </div>
                      )}
                      {showHeader && <SeenStatus msg={msg} currentUserId={currentUserId} />}
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
            <span style={{ color: themeWiseColor('#8c8c8c', '#595959', themeMode), fontSize: 12, fontStyle: 'italic' }}>{typingText}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div style={{
        padding: '10px 14px',
        borderTop: `1px solid ${themeWiseColor('#f0f0f0', '#1f1f1f', themeMode)}`,
        background: themeWiseColor('#fafafa', '#1a1a1a', themeMode),
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <TextArea
            ref={textAreaRef}
            value={input}
            onChange={handleInputWithDebounce}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            autoSize={{ minRows: 1, maxRows: 5 }}
            maxLength={2000}
            disabled={!connected}
            style={{
              background: themeWiseColor('#ffffff', '#141414', themeMode),
              border: `1px solid ${themeWiseColor('#d9d9d9', '#262626', themeMode)}`,
              borderRadius: 12, color: themeWiseColor('#262626', '#d9d9d9', themeMode),
              resize: 'none', fontSize: 14,
              transition: 'border-color 0.2s',
              paddingRight: 55, // Increased padding
              paddingTop: 8,
              paddingBottom: 8,
            }}
          />

          {/* Emoji Trigger */}
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            right: 14, 
            transform: 'translateY(-50%)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            zIndex: 10
          }}>
            <Popover
              content={
                <div style={{ 
                  height: 435, 
                  boxShadow: themeWiseColor('0 8px 24px rgba(0,0,0,0.1)', '0 8px 24px rgba(0,0,0,0.5)', themeMode), 
                  borderRadius: 12, 
                  overflow: 'hidden',
                  zIndex: 9999
                }}>
                  <Picker 
                    data={data} 
                    onEmojiSelect={onEmojiSelect}
                    theme={themeMode === 'dark' ? 'dark' : 'light'}
                    set="native"
                  />
                </div>
              }
              trigger="click"
              open={showEmojiPicker}
              onOpenChange={setShowEmojiPicker}
              placement="topRight"
              overlayInnerStyle={{ padding: 0 }}
              getPopupContainer={(trigger) => trigger.parentElement || document.body}
            >
              <Button
                type="text"
                icon={<SmileOutlined style={{ fontSize: 20, color: showEmojiPicker ? '#1677ff' : '#8c8c8c' }} />}
                style={{ height: 32, width: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            </Popover>

            {input.length > 0 && (
              <span style={{ color: themeWiseColor('#bfbfbf', '#303030', themeMode), fontSize: 10, pointerEvents: 'none' }}>
                {input.length}/2000
              </span>
            )}
          </div>
        </div>

        <button
          onClick={sendMessage}
          disabled={!input.trim() || !connected}
          style={{
            background: input.trim() && connected
              ? 'linear-gradient(135deg, #1677ff, #0958d9)'
              : themeWiseColor('#f5f5f5', '#1f1f1f', themeMode),
            border: 'none', borderRadius: 12,
            width: 40, height: 40, minWidth: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() && connected ? 'pointer' : 'not-allowed',
            color: input.trim() && connected ? '#fff' : themeWiseColor('#bfbfbf', '#434343', themeMode),
            transition: 'all 0.2s', flexShrink: 0,
            boxShadow: input.trim() && connected ? '0 2px 8px rgba(22,119,255,0.4)' : 'none',
          }}
        >
          <SendOutlined style={{ fontSize: 16 }} />
        </button>
      </div>

      <Modal
        title="Delete Message"
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setMessageToDelete(null);
        }}
        footer={null}
        width={350}
        centered
        styles={{ body: { padding: '20px 24px', backgroundColor: themeWiseColor('#fff', '#1f1f1f', themeMode) } }}
      >
        <div style={{ marginBottom: 20, color: themeWiseColor('#262626', '#d9d9d9', themeMode) }}>
          What would you like to do with this message?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button 
            onClick={() => handleDeleteFinal('me')}
            style={{ borderRadius: 6, background: themeWiseColor('#f5f5f5', '#1f1f1f', themeMode), color: themeWiseColor('#262626', '#d9d9d9', themeMode), border: `1px solid ${themeWiseColor('#d9d9d9', '#303030', themeMode)}` }}
          >
            Remove from my chat
          </Button>

          {messageToDelete && String(messageToDelete.user_id) === currentUserId && !messageToDelete.isDeleted && (
            <Button 
              type="primary" 
              danger 
              onClick={() => handleDeleteFinal('everyone')}
              style={{ borderRadius: 6 }}
            >
              Delete for Everyone
            </Button>
          )}

          <Button 
            type="text"
            onClick={() => {
              setDeleteModalVisible(false);
              setMessageToDelete(null);
            }}
            style={{ color: '#8c8c8c' }}
          >
            Cancel
          </Button>
        </div>
      </Modal>

      {/* ── Scoped styles ── */}
      <style>{`
        .msg-wrapper:hover .chat-action-btn { opacity: 1 !important; }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        .typing-dot { animation: typingBounce 1.2s ease-in-out infinite; }
        .dot-0 { animation-delay: 0s; }
        .dot-1 { animation-delay: 0.15s; }
        .dot-2 { animation-delay: 0.30s; }
        div[style*="overflow-y: auto"]::-webkit-scrollbar { width: 5px; }
        div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb { 
            background: ${themeWiseColor('#d9d9d9', '#2a2a2a', themeMode)}; 
            border-radius: 99px; 
        }
        .ant-modal-content, .ant-modal-header {
            background-color: ${themeWiseColor('#fff', '#1f1f1f', themeMode)} !important;
        }
        .ant-modal-title {
            color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
        }
      `}</style>
    </div>
  );
};

export default ProjectViewUpdates;

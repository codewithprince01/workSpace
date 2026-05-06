import React, { useEffect, useState } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Card, 
  Tabs, 
  Progress, 
  Avatar, 
  Tooltip, 
  Popconfirm, 
  message,
  Badge,
  Input,
  Select,
  Dropdown,
  Popover,
  Checkbox,
  DatePicker,
  Spin
} from 'antd';
import { 
  PlusOutlined, 
  CheckCircleOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  TrophyOutlined,
  WarningOutlined,
  UserOutlined,
  ReloadOutlined,
  FlagOutlined,
  BulbOutlined,
  TagOutlined,
  UserAddOutlined,
  TeamOutlined,
  InboxOutlined,
  MoreOutlined,
  CloseOutlined,
  MinusOutlined,
  CaretUpFilled,
  CalendarOutlined,
  FilterOutlined,
  CommentOutlined,
  SendOutlined
} from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchTodos, updateTodo, deleteTodo, setActiveView, bulkUpdateTodos, bulkDeleteTodos } from './todoSlice';
import { todoApiService, ITodo, ITodoComment } from '@/api/todo/todo.api.service';
import TodoFormModal from './TodoFormModal';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;

const getColorFromName = (name: string) => {
    const colors = [
        '#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#1890ff', 
        '#52c41a', '#eb2f96', '#fa8c16', '#a0d911', '#13c2c2'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

const MemberAssigneePopover: React.FC<{ 
    todo: ITodo, 
    isDark: boolean,
    onUpdate: (userIds: string[]) => void 
}> = ({ todo, isDark, onUpdate }) => {
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const res = await todoApiService.searchUsers(search);
                if (res.done) {
                    console.log(`[Frontend] Search results for "${search}":`, res.body);
                    setUsers(res.body || []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, [search]);

    const currentIds = (todo.assigned_to || []).filter(u => !!u && !!u._id).map(u => u._id);

    const handleToggle = (userId: string) => {
        const newIds = currentIds.includes(userId)
            ? currentIds.filter(id => id !== userId)
            : [...currentIds, userId];
        onUpdate(newIds);
    };

    return (
        <div style={{ 
            background: isDark ? '#1d2633' : '#fff', 
            borderRadius: 8, 
            width: 280, 
            overflow: 'hidden',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.1)'
        }}>
            <div style={{ padding: 12 }}>
                <Input 
                    placeholder="Search members..." 
                    prefix={<SearchOutlined style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} />}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ 
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', 
                        border: `1px solid ${isDark ? '#2f80ed' : '#d9d9d9'}`,
                        color: isDark ? '#fff' : '#262626',
                        borderRadius: 6
                    }}
                />
            </div>
            
            <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                {loading && users.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Loading...</Text>
                    </div>
                ) : users.map(user => (
                    <div 
                        key={user._id}
                        onClick={() => handleToggle(user._id)}
                        style={{ 
                            padding: '10px 16px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 12,
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        className="member-item"
                    >
                        <Checkbox 
                            checked={currentIds.includes(user._id)} 
                            style={{ 
                                color: '#2f80ed'
                            }} 
                        />
                        <Avatar 
                            src={user.avatar_url} 
                            size="small" 
                            style={{ 
                                background: getColorFromName(user.name), 
                                border: '1px solid rgba(255,255,255,0.1)',
                                fontWeight: 600
                            }}
                        >
                            {user.name[0].toUpperCase()}
                        </Avatar>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <Text style={{ color: isDark ? '#fff' : '#262626', fontSize: 13, fontWeight: 500 }}>{user.name}</Text>
                            <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', fontSize: 11 }}>{user.email}</Text>
                        </div>
                    </div>
                ))}
                {users.length === 0 && !loading && (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No members found</Text>
                    </div>
                )}
            </div>

            <div style={{ 
                padding: '12px 16px', 
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                color: '#2f80ed'
            }}>
                <UserAddOutlined style={{ fontSize: 14 }} />
                <Text style={{ color: '#2f80ed', fontSize: 13 }}>Invite member</Text>
            </div>
            <style>{`
                .member-item:hover { background: ${isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'} !important; }
                .member-item .ant-checkbox-inner { background: transparent !important; border-color: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' } !important; }
                .member-item .ant-checkbox-checked .ant-checkbox-inner { background: #1890ff !important; border-color: #1890ff !important; }
            `}</style>
        </div>
    );
};

// ─── Comment Section Component ─────────────────────────────────────────────
const TodoCommentSection: React.FC<{ todoId: string; isDark: boolean }> = ({ todoId, isDark }) => {
  const [comments, setComments] = useState<ITodoComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (!todoId) return;
    setLoading(true);
    todoApiService.getComments(todoId)
      .then(res => { if (res.done) setComments(res.body); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [todoId]);

  const handleSubmit = async () => {
    const text = newComment.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await todoApiService.addComment(todoId, text);
      if (res.done) {
        setComments(prev => [...prev, res.body]);
        setNewComment('');
      }
    } catch {
      message.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await todoApiService.deleteComment(todoId, commentId);
      if (res.done) setComments(prev => prev.filter(c => c._id !== commentId));
    } catch {
      message.error('Failed to delete comment');
    }
  };

  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0';
  const bg = isDark ? 'rgba(255,255,255,0.03)' : '#f8f9fb';
  const textColor = isDark ? '#e0e0e0' : '#262626';
  const secondaryColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#fff';
  const inputBorder = isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #d9d9d9';

  return (
    <div style={{ marginTop: 24, borderTop: border, paddingTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <CommentOutlined style={{ color: '#1890ff', fontSize: 16 }} />
        <Typography.Text strong style={{ color: textColor, fontSize: 14, letterSpacing: '0.05em' }}>
          COMMENTS
        </Typography.Text>
        {comments.length > 0 && (
          <span style={{
            background: '#1890ff',
            color: '#fff',
            borderRadius: 10,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 700
          }}>{comments.length}</span>
        )}
      </div>

      {/* Comment List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}><Spin size="small" /></div>
      ) : comments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '20px 0',
          background: bg,
          borderRadius: 8,
          border,
          marginBottom: 16
        }}>
          <CommentOutlined style={{ fontSize: 24, color: secondaryColor, display: 'block', marginBottom: 6 }} />
          <Typography.Text style={{ color: secondaryColor, fontSize: 12 }}>No comments yet. Be the first!</Typography.Text>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {comments.map(c => (
            <div key={c._id} style={{
              display: 'flex',
              gap: 10,
              background: bg,
              borderRadius: 10,
              padding: '10px 14px',
              border,
              position: 'relative'
            }}>
              <Avatar
                size={32}
                src={c.author?.avatar_url}
                style={{ background: '#1890ff', flexShrink: 0, fontWeight: 700, fontSize: 13 }}
              >
                {(c.author?.name || 'U')[0].toUpperCase()}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Typography.Text strong style={{ color: textColor, fontSize: 13 }}>
                    {c.author?.name || 'Unknown'}
                  </Typography.Text>
                  <Typography.Text style={{ color: secondaryColor, fontSize: 11 }}>
                    {dayjs(c.created_at).fromNow()}
                  </Typography.Text>
                </div>
                <Typography.Paragraph style={{
                  margin: 0,
                  color: textColor,
                  fontSize: 13,
                  lineHeight: '1.6',
                  wordBreak: 'break-word'
                }}>
                  {c.content}
                </Typography.Paragraph>
              </div>
              <Popconfirm
                title="Delete this comment?"
                onConfirm={() => handleDelete(c._id)}
                okText="Yes"
                cancelText="No"
                placement="left"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  style={{ color: '#ff4d4f', opacity: 0.6, position: 'absolute', top: 8, right: 8 }}
                  className="comment-delete-btn"
                />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}

      {/* Add Comment Input */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Input.TextArea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Write a comment…"
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          style={{
            background: inputBg,
            border: inputBorder,
            color: textColor,
            borderRadius: 8,
            resize: 'none',
            flex: 1
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={submitting}
          disabled={!newComment.trim()}
          style={{ borderRadius: 8, height: 36, minWidth: 64 }}
        >
          Post
        </Button>
      </div>
      <Typography.Text style={{ color: secondaryColor, fontSize: 11, marginTop: 6, display: 'block' }}>
        Press Enter to post · Shift+Enter for new line
      </Typography.Text>
    </div>
  );
};
// ────────────────────────────────────────────────────────────────────────────

const TodoPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { todos, loading, activeView } = useAppSelector(state => state.todoReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<ITodo | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    console.log('[TodoPage] Fetching with params:', { 
      view: activeView, 
      search, 
      status: statusFilter,
      priority: priorityFilter 
    });
    dispatch(fetchTodos({ 
      view: activeView, 
      search, 
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter
    }));
  }, [dispatch, activeView, search, statusFilter, priorityFilter]);

  const handleEdit = (todo: ITodo) => {
    setEditingTodo(todo);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await dispatch(deleteTodo(id)).unwrap();
      message.success('Todo deleted');
    } catch (err: any) {
      message.error(err || 'Failed to delete');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await dispatch(bulkDeleteTodos(selectedRowKeys as string[])).unwrap();
      message.success(`${selectedRowKeys.length} todos deleted`);
      setSelectedRowKeys([]);
    } catch (err: any) {
      message.error(err || 'Bulk delete failed');
    }
  };

  const handleBulkUpdate = async (data: Partial<ITodo>) => {
      try {
          await dispatch(bulkUpdateTodos({ ids: selectedRowKeys as string[], data })).unwrap();
          message.success(`${selectedRowKeys.length} tasks updated`);
          setSelectedRowKeys([]);
      } catch (err) {
          message.error('Bulk update failed');
      }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      render: (text: string, record: ITodo) => (
        <Tooltip title={text} placement="topLeft" mouseEnterDelay={0.5}>
            <div onClick={() => handleEdit(record)} style={{ cursor: 'pointer' }}>
                <Text 
                  strong 
                  ellipsis={{ tooltip: false }}
                  style={{ 
                      fontSize: 14, 
                      color: record.status === 'completed' ? '#8c8c8c' : (isDark ? '#fff' : '#262626'),
                      textDecoration: record.status === 'completed' ? 'line-through' : 'none',
                      display: 'block'
                  }}
                >
                  {text}
                </Text>
            </div>
        </Tooltip>
      ),
    },
    {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (text: string, record: ITodo) => (
            <Tooltip title={text} placement="topLeft" mouseEnterDelay={0.5}>
                <div onClick={() => handleEdit(record)} style={{ cursor: 'pointer' }}>
                    <Text 
                        type="secondary" 
                        ellipsis={{ tooltip: false }} 
                        style={{ fontSize: 12, display: 'block' }}
                    >
                        {text || '—'}
                    </Text>
                </div>
            </Tooltip>
        )
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      width: 100,
      align: 'center' as const,
      render: (val: number) => (
        <div style={{ 
            background: isDark ? '#262626' : '#f0f0f0', 
            borderRadius: '50%', 
            width: 32, 
            height: 32, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto'
        }}>
          <Text style={{ color: isDark ? '#fff' : '#262626', fontSize: 11, fontWeight: 600 }}>{val}%</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      align: 'center' as const,
      sorter: (a: ITodo, b: ITodo) => {
        const order: any = { pending: 1, 'in-progress': 2, completed: 3 };
        return (order[a.status || 'pending'] || 0) - (order[b.status || 'pending'] || 0);
      },
      render: (status: string, record: ITodo) => {
        const s = status || 'pending';
        const statusMap: any = {
          pending: { label: 'To Do', color: '#8c8c8c', key: 'pending', bg: 'rgba(255,255,255,0.1)' },
          'in-progress': { label: 'In Progress', color: '#fff', key: 'in-progress', bg: '#1890ff' },
          completed: { label: 'Done', color: '#fff', key: 'completed', bg: '#52c41a' }
        };
        const current = statusMap[s] || statusMap.pending;

        const menuItems = Object.values(statusMap).map((item: any) => ({
          key: item.key,
          label: (
            <div 
              style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  minWidth: 140
              }}
            >
              <Space size={12}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                <Text style={{ color: isDark ? '#fff' : '#262626' }}>{item.label}</Text>
              </Space>
              {s === item.key && (
                <Text style={{ color: '#2f80ed', fontSize: 12, fontWeight: 600 }}>●</Text>
              )}
            </div>
          ),
          onClick: () => {
            const newProgress = item.key === 'completed' ? 100 : (record.status === 'completed' ? 0 : record.progress);
            dispatch(updateTodo({ id: record._id, data: { status: item.key, progress: newProgress } }));
          }
        }));

        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomCenter">
            <div style={{ 
                background: current.bg, 
                border: s === 'pending' ? `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}` : 'none',
                borderRadius: 20,
                padding: '4px 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: current.color,
                fontSize: 13,
                fontWeight: 500
            }}>
              {current.label} <span style={{ fontSize: 10, opacity: 0.7 }}>^</span>
            </div>
          </Dropdown>
        );
      }
    },
    {
      title: 'Assignees',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      width: 160,
      render: (users: any[], record: ITodo) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Avatar.Group 
                maxCount={4} 
                size="small"
                style={{ marginLeft: 4 }}
            >
                {(users || []).filter(u => !!u && !!u._id).map(u => (
                    <Tooltip key={u._id} title={u.name || 'Unknown'}>
                        <Avatar 
                            src={u.avatar_url} 
                            style={{ 
                                background: getColorFromName(u.name), 
                                border: `2px solid ${isDark ? '#262626' : '#fff'}`,
                                fontWeight: 600,
                                fontSize: 12
                            }}
                        >
                            {u.name[0].toUpperCase()}
                        </Avatar>
                    </Tooltip>
                ))}
            </Avatar.Group>
            
            <Popover 
                content={
                    <MemberAssigneePopover 
                        todo={record} 
                        isDark={isDark}
                        onUpdate={(ids) => dispatch(updateTodo({ id: record._id, data: { assigned_to: ids as any } }))} 
                    />
                } 
                trigger="click"
                placement="bottom"
                overlayInnerStyle={{ padding: 0, background: 'transparent', border: 'none' }}
            >
                <div 
                    style={{ 
                        width: 24, 
                        height: 24, 
                        borderRadius: '50%', 
                        border: `1px dashed ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                        fontSize: 14,
                        marginLeft: 4
                    }}
                >
                    +
                </div>
            </Popover>
        </div>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 140,
      sorter: (a: ITodo, b: ITodo) => {
        const order: any = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (order[a.priority || 'medium'] || 0) - (order[b.priority || 'medium'] || 0);
      },
      render: (priority: string, record: ITodo) => {
        const p = priority || 'medium';
        const priorityMap: any = {
          low: { label: 'Low', color: '#52c41a', key: 'low', icon: <MinusOutlined />, bg: '#52c41a' },
          medium: { label: 'Medium', color: '#1890ff', key: 'medium', icon: <span style={{ fontWeight: 'bold' }}>=</span>, bg: '#1890ff' },
          high: { label: 'High', color: '#fa8c16', key: 'high', icon: <div style={{ transform: 'rotate(90deg)', display: 'inline-block' }}>{'>>'}</div>, bg: '#fa8c16' },
          urgent: { label: 'Urgent', color: '#f5222d', key: 'urgent', icon: <CaretUpFilled />, bg: '#f5222d' }
        };
        const current = priorityMap[p] || priorityMap.medium;

        const priorityMenuItems = Object.values(priorityMap).map((item: any) => ({
          key: item.key,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 140 }}>
                <div style={{ width: 20, display: 'flex', justifyContent: 'center', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)' }}>
                    {item.icon}
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                <Text style={{ color: isDark ? '#fff' : '#262626', flex: 1 }}>{item.label}</Text>
                {p === item.key && (
                  <Text style={{ color: '#2f80ed', fontSize: 11 }}>●</Text>
                )}
            </div>
          ),
          onClick: () => {
            dispatch(updateTodo({ id: record._id, data: { priority: item.key } }));
          }
        }));

        return (
          <Dropdown menu={{ items: priorityMenuItems }} trigger={['click']} placement="bottomCenter">
            <div style={{ 
                background: current.bg, 
                borderRadius: 20,
                padding: '4px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                minWidth: 100,
                justifyContent: 'space-between'
            }}>
              <Space size={6}>
                  {current.icon}
                  <span>{current.label}</span>
              </Space>
              <span style={{ fontSize: 10, opacity: 0.8 }}>^</span>
            </div>
          </Dropdown>
        );
      }
    },
    {
        title: 'Labels',
        dataIndex: 'labels',
        key: 'labels',
        width: 180,
        render: (labels: string[]) => (
            <Space size={[0, 4]} wrap>
                {(labels || []).map(label => (
                    <Tag 
                        key={label} 
                        color="blue" 
                        style={{ 
                            borderRadius: 12, 
                            fontSize: 10, 
                            background: 'rgba(47, 128, 237, 0.1)',
                            border: '1px solid rgba(47, 128, 237, 0.3)',
                            color: '#2f80ed',
                            fontWeight: 600
                        }}
                    >
                        {label.toUpperCase()}
                    </Tag>
                ))}
                {(!labels || labels.length === 0) && <Text type="secondary" style={{ fontSize: 11 }}>—</Text>}
            </Space>
        )
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 150,
      sorter: (a: ITodo, b: ITodo) => {
          const dA = a.due_date ? dayjs(a.due_date).valueOf() : 0;
          const dB = b.due_date ? dayjs(b.due_date).valueOf() : 0;
          return dA - dB;
      },
      render: (date: string, record: ITodo) => {
          const isOverdue = date && dayjs(date).isBefore(dayjs(), 'day') && record.status !== 'completed';
          const tooltipTitle = date 
            ? `Deadline: ${dayjs(date).format('dddd, MMMM D, YYYY [at] hh:mm A')} (Created: ${dayjs(record.created_at).format('MMM DD')})`
            : 'No deadline set';

          return (
              <div onClick={(e) => e.stopPropagation()}>
                <Tooltip title={tooltipTitle} placement="top">
                  <DatePicker 
                    value={date ? dayjs(date) : null}
                    onChange={(val) => {
                        const newDate = val ? val.toISOString() : null;
                        dispatch(updateTodo({ id: record._id, data: { due_date: newDate } }));
                    }}
                    showTime={{ format: 'hh:mm A', use12Hours: true }}
                    format="MMM DD, YYYY hh:mm A"
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                    bordered={false}
                    placeholder="No date"
                    style={{ 
                        padding: 0,
                        color: isOverdue ? '#ff4d4f' : (isDark ? '#d9d9d9' : '#595959'),
                        fontWeight: isOverdue ? 600 : 400,
                        width: '100%'
                    }}
                    className={`inline-date-picker ${isDark ? 'dark' : ''}`}
                  />
                </Tooltip>
              </div>
          );
      }
    },
    {
        title: 'Performance',
        key: 'performance',
        width: 140,
        render: (_: any, record: ITodo) => {
          const dueDate = record.due_date ? dayjs(record.due_date) : null;
          
          const formatDuration = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
              const totalMinutes = Math.abs(end.diff(start, 'minute'));
              const days = Math.floor(totalMinutes / (24 * 60));
              const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
              const mins = totalMinutes % 60;

              if (days > 0) return `${days}d ${hours}h`;
              if (hours > 0) return `${hours}h ${mins}m`;
              return `${mins}m`;
          };

          if (record.status === 'completed') {
            const completedAt = record.completed_at ? dayjs(record.completed_at) : null;
            if (!completedAt || !dueDate) return <Text type="secondary">—</Text>;

            const onTime = completedAt.isBefore(dueDate) || completedAt.isSame(dueDate);
            
            return (
              <Tag color={onTime ? 'success' : '#f5222d'} style={{ borderRadius: 12, fontWeight: 600 }}>
                {onTime ? 'ON TIME' : `LATE (${formatDuration(dueDate, completedAt)})`}
              </Tag>
            );
          }

          // Check if pending but already past due
          if (dueDate && dueDate.isBefore(dayjs()) && record.status !== 'completed') {
            return (
                <Tag color="#f5222d" style={{ borderRadius: 12, fontWeight: 600 }}>
                  OVERDUE ({formatDuration(dueDate, dayjs())})
                </Tag>
            );
          }

          return <Text type="secondary">—</Text>;
        }
    },
    {
        title: 'Completed At',
        dataIndex: 'completed_at',
        key: 'completed_at',
        width: 150,
        sorter: (a: ITodo, b: ITodo) => {
            const dA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
            const dB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
            return dA - dB;
        },
        render: (date: string) => date ? <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(date).format('MMM DD, HH:mm')}</Text> : <Text type="secondary">—</Text>
    },
    {
      title: 'Last Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      sorter: (a: ITodo, b: ITodo) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
      render: (date: string) => <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(date).fromNow()}</Text>
    },
    {
        title: 'Created By',
        dataIndex: 'created_by',
        key: 'created_by',
        width: 150,
        render: (user: any) => (
            <Space size={4}>
                <Avatar 
                    size="small" 
                    src={user?.avatar_url} 
                    style={{ background: '#f56a00', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                    {user?.name?.[0]?.toUpperCase() || 'S'}
                </Avatar>
                <Text style={{ fontSize: 11 }}>{user?.name || 'System'}</Text>
            </Space>
        )
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const handleBulkComplete = async (status: 'completed' | 'pending') => {
      try {
          const updates = (selectedRowKeys as string[]).map(id => 
            dispatch(updateTodo({ 
                id, 
                data: { 
                    status,
                    progress: status === 'completed' ? 100 : 0
                } 
            })).unwrap()
          );
          await Promise.all(updates);
          message.success(`Updated ${selectedRowKeys.length} items`);
          setSelectedRowKeys([]);
      } catch (err: any) {
          message.error(err || 'Update failed');
      }
  }

  return (
    <div style={{ minHeight: '100vh', background: isDark ? '#141414' : '#fff', position: 'relative' }}>
      <div style={{ width: '100%', margin: '0', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, padding: '0' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4, color: isDark ? '#fff' : 'inherit' }}>Advanced Todo System</Title>
          <Text type="secondary" style={{ color: isDark ? '#aaa' : undefined }}>A professional-grade todo management module with full lifecycle tracking and performance insights.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button 
            icon={<ReloadOutlined spin={loading} style={{ fontSize: 16 }} />} 
            onClick={() => {
                dispatch(fetchTodos({ 
                    view: activeView, 
                    search, 
                    status: statusFilter === 'all' ? undefined : statusFilter,
                    priority: priorityFilter === 'all' ? undefined : priorityFilter
                }));
            }}
            style={{ 
                borderRadius: '50%', 
                height: 40, 
                width: 40, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0',
                border: 'none',
                color: isDark ? '#fff' : '#595959',
                transition: 'all 0.3s'
            }}
            className="refresh-btn"
          />
          <Button 
            type="primary" 
            size="large" 
            icon={<PlusOutlined />} 
            onClick={() => { setEditingTodo(null); setModalOpen(true); }}
            style={{ 
                borderRadius: 8, 
                height: 40, 
                background: '#1677ff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(22,119,255,0.2)',
                fontWeight: 600,
            }}
          >
            Create New Todo
          </Button>
        </div>
      </div>

      <Card 
        bodyStyle={{ padding: 0 }} 
        style={{ 
          borderRadius: 0, 
          overflow: 'hidden', 
          border: 'none',
          background: 'transparent',
          boxShadow: 'none'
        }}
      >
        <div style={{ 
          padding: '12px 24px', 
          background: 'transparent', 
          borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0', 
          display: 'flex', 
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tabs 
                activeKey={activeView} 
                onChange={(key) => dispatch(setActiveView(key as 'my' | 'assigned'))}
                tabBarStyle={{ marginBottom: 0 }}
                items={[
                { key: 'my', label: <span style={{ fontWeight: 600, color: isDark && activeView !== 'my' ? '#888' : undefined }}>MY TODOS</span> },
                { key: 'assigned', label: <span style={{ fontWeight: 600, color: isDark && activeView !== 'assigned' ? '#888' : undefined }}>ASSIGNED TO ME</span> }
                ]}
            />
            <Input 
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Search by title or labels..." 
                style={{ 
                width: 300, 
                borderRadius: 8,
                background: isDark ? '#141414' : '#fff',
                border: isDark ? '1px solid #303030' : undefined,
                color: isDark ? '#fff' : undefined,
                height: 36
                }}
                onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
             <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 140 }}
                placeholder="Status"
                suffixIcon={<FilterOutlined />}
                options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'pending', label: 'To Do' },
                    { value: 'in-progress', label: 'In Progress' },
                    { value: 'completed', label: 'Done' },
                ]}
             />

             <Select
                value={priorityFilter}
                onChange={setPriorityFilter}
                style={{ width: 140 }}
                placeholder="Priority"
                options={[
                    { value: 'all', label: 'All Priority' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'urgent', label: 'Urgent' },
                ]}
             />

             <Button 
                type="text" 
                size="small" 
                onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); setSearch(''); }}
                style={{ color: '#1890ff', fontSize: 12 }}
             >
                Reset Filters
             </Button>
          </div>
        </div>
        
        <Table 
          rowSelection={rowSelection}
          columns={columns.filter(c => ['title', 'status', 'priority', 'assigned_to', 'due_date', 'performance'].includes(c.key as string))} 
          dataSource={todos} 
          loading={loading}
          rowKey="_id"
          pagination={{ pageSize: 15, showSizeChanger: true }}
          expandable={{
            expandedRowRender: (record: ITodo) => (
              <div style={{ 
                padding: '16px 24px', 
                background: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
                borderRadius: 8,
                margin: '8px 16px',
                borderLeft: `4px solid ${isDark ? '#2f80ed' : '#1890ff'}`
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 8, color: isDark ? '#fff' : '#262626' }}>DESCRIPTION</Text>
                    <Text type="secondary" style={{ fontSize: 13, lineHeight: '1.6' }}>
                      {record.description || 'No description provided.'}
                    </Text>
                    
                    <div style={{ marginTop: 24 }}>
                      <Text strong style={{ display: 'block', marginBottom: 12, color: isDark ? '#fff' : '#262626' }}>PROGRESS</Text>
                      <div style={{ maxWidth: 300 }}>
                        <Progress 
                          percent={record.progress} 
                          size="small" 
                          status={record.status === 'completed' ? 'success' : 'active'} 
                          strokeColor={record.status === 'completed' ? '#52c41a' : '#1890ff'}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ borderLeft: isDark ? '1px solid #303030' : '1px solid #f0f0f0', paddingLeft: 24 }}>
                    <Text strong style={{ display: 'block', marginBottom: 16, color: isDark ? '#fff' : '#262626' }}>TASK METADATA</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">Completed At:</Text>
                        <Text style={{ color: isDark ? '#ddd' : '#595959' }}>
                          {record.completed_at ? dayjs(record.completed_at).format('MMM DD, YYYY hh:mm A') : '—'}
                        </Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">Created By:</Text>
                        {columns.find(c => c.key === 'created_by')?.render?.(record.created_by, record, 0)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">Last Updated:</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(record.updated_at).fromNow()}</Text>
                      </div>
                    </div>
                    
                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                      <Button 
                        type="link" 
                        icon={<EditOutlined />} 
                        onClick={() => handleEdit(record)}
                        style={{ padding: 0 }}
                      >
                        Edit Full Details
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── Comments Section ── */}
                <TodoCommentSection todoId={record._id} isDark={isDark} />
              </div>
            ),
            expandRowByClick: false,
          }}
          rowClassName={(record) => {
            const classes = [];
            if (record.is_overdue) classes.push(isDark ? 'todo-row-overdue-dark' : 'todo-row-overdue');
            if (record.status === 'completed') classes.push('todo-row-completed');
            return classes.join(' ');
          }}
          style={{ cursor: 'pointer' }}
        />
      </Card>
      </div>

      {/* FLOATING BULK ACTIONS BAR - MATCHING DESIGN */}
      {selectedRowKeys.length > 0 && (
        <div style={{ 
            position: 'fixed', 
            bottom: 40, 
            left: '50%', 
            transform: 'translateX(-50%)', 
            background: isDark ? '#1d2633' : '#fff', 
            padding: '12px 24px', 
            borderRadius: 40, 
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            animation: 'slideUp 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: '#2f80ed', 
                    color: '#fff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: 14, 
                    fontWeight: 600 
                }}>
                    {selectedRowKeys.length}
                </div>
                <Text style={{ color: isDark ? '#fff' : '#262626', fontWeight: 500, fontSize: 14 }}>
                    {selectedRowKeys.length} tasks selected
                </Text>
            </div>

            <div style={{ width: 1, height: 24, background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }} />

            <Space size={24} style={{ padding: '0 10px' }}>
                <Tooltip title="Edit Selected">
                    <EditOutlined 
                        onClick={() => {
                            const firstId = selectedRowKeys[0] as string;
                            const todo = todos.find(t => t._id === firstId);
                            if (todo) handleEdit(todo);
                        }}
                        style={{ fontSize: 20, color: '#2f80ed', cursor: 'pointer' }} 
                    />
                </Tooltip>

                <Tooltip title="Bulk Set Priority">
                    <Dropdown overlay={
                        <div style={{ 
                            background: isDark ? '#1d2633' : '#fff', 
                            padding: '8px 0', 
                            borderRadius: 8, 
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` 
                        }}>
                            {['urgent', 'high', 'medium', 'low'].map(p => (
                                <div key={p} onClick={() => handleBulkUpdate({ priority: p })} style={{ padding: '8px 16px', color: isDark ? '#fff' : '#262626', cursor: 'pointer' }} className="status-menu-item">
                                    {p.toUpperCase()}
                                </div>
                            ))}
                        </div>
                    } trigger={['click']}>
                        <FlagOutlined style={{ fontSize: 20, color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)', cursor: 'pointer' }} />
                    </Dropdown>
                </Tooltip>

                <Tooltip title="Bulk Set Status">
                    <Dropdown overlay={
                        <div style={{ 
                            background: isDark ? '#1d2633' : '#fff', 
                            padding: '8px 0', 
                            borderRadius: 8, 
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` 
                        }}>
                            {['pending', 'in-progress', 'completed'].map(s => (
                                <div key={s} onClick={() => handleBulkUpdate({ status: s, progress: s === 'completed' ? 100 : 0 })} style={{ padding: '8px 16px', color: isDark ? '#fff' : '#262626', cursor: 'pointer' }} className="status-menu-item">
                                    {s.toUpperCase()}
                                </div>
                            ))}
                        </div>
                    } trigger={['click']}>
                        <CheckCircleOutlined style={{ fontSize: 22, color: '#52c41a', cursor: 'pointer' }} />
                    </Dropdown>
                </Tooltip>

                <Popconfirm 
                    title={`Delete ${selectedRowKeys.length} tasks?`}
                    onConfirm={handleBulkDelete}
                    okText="Yes"
                    cancelText="No"
                >
                    <Tooltip title="Bulk Delete">
                        <DeleteOutlined style={{ fontSize: 20, color: '#ff4d4f', cursor: 'pointer' }} />
                    </Tooltip>
                </Popconfirm>
            </Space>

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />

            <CloseOutlined 
                onClick={() => setSelectedRowKeys([])} 
                style={{ fontSize: 18, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', cursor: 'pointer', paddingLeft: 4 }} 
            />
        </div>
      )}
      <TodoFormModal 
        open={modalOpen} 
        todo={editingTodo} 
        onClose={() => setModalOpen(false)} 
      />

      <style>{`
        .todo-row-overdue {
          background-color: #fff1f0 !important;
        }
        .todo-row-overdue-dark {
          background-color: #2a1215 !important;
        }
        .todo-row-completed {
            opacity: 0.8;
            background-color: ${isDark ? '#1a1a1a' : '#f6ffed'} !important;
        }
        .todo-row-overdue:hover > td, .todo-row-overdue-dark:hover > td {
          background-color: inherit !important;
          opacity: 0.9;
        }
        .ant-table-thead > tr > th {
          background: ${isDark ? '#141414' : '#f5f5f5'} !important;
          font-weight: 700 !important;
          color: ${isDark ? '#fff' : '#434343'} !important;
          border-bottom: ${isDark ? '1px solid #303030' : '1px solid #f0f0f0'} !important;
          font-size: 12px;
          text-transform: uppercase;
        }
        .ant-table-cell-fix-left, .ant-table-cell-fix-right {
          background: ${isDark ? '#1f1f1f' : '#fff'} !important;
        }
        .ant-table {
          background: ${isDark ? '#1f1f1f' : '#fff'} !important;
          color: ${isDark ? '#fff' : 'inherit'} !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: ${isDark ? '1px solid #303030' : '1px solid #f0f0f0'} !important;
          padding: 12px 16px !important;
        }
        .ant-table-tbody > tr:hover > td {
          background: ${isDark ? '#262626' : '#f0f5ff'} !important;
        }
        .comment-delete-btn {
          opacity: 0 !important;
          transition: opacity 0.2s !important;
        }
        div:hover > .comment-delete-btn, div:has(> .comment-delete-btn):hover .comment-delete-btn {
          opacity: 0.7 !important;
        }
      `}</style>
      <style>{`
        .status-menu-item:hover {
            background: rgba(255,255,255,0.05);
        }
        .status-select .ant-select-selector {
            padding: 0 !important;
        }
      `}</style>
    <style>{`
        .inline-date-picker input {
            cursor: pointer !important;
            color: inherit !important;
        }
        .inline-date-picker.dark .ant-picker-suffix {
            color: rgba(255,255,255,0.3) !important;
        }
        .inline-date-picker:hover {
            background: rgba(0,0,0,0.02);
        }
        .dark .inline-date-picker:hover {
            background: rgba(255,255,255,0.05);
        }
    `}</style>
    </div>
  );
};

export default TodoPage;

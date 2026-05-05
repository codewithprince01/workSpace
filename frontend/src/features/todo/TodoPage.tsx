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
  Checkbox
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
  FilterOutlined
} from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchTodos, updateTodo, deleteTodo, setActiveView, bulkUpdateTodos, bulkDeleteTodos } from './todoSlice';
import { todoApiService, ITodo } from '@/api/todo/todo.api.service';
import TodoFormModal from './TodoFormModal';
import moment from 'moment';

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
      fixed: 'left' as const,
      render: (text: string, record: ITodo) => (
        <div onClick={() => handleEdit(record)} style={{ cursor: 'pointer' }}>
            <Text 
              strong 
              style={{ 
                  fontSize: 14, 
                  color: record.status === 'completed' ? '#8c8c8c' : (isDark ? '#fff' : '#262626'),
                  textDecoration: record.status === 'completed' ? 'line-through' : 'none'
              }}
            >
              {text}
            </Text>
        </div>
      ),
    },
    {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (text: string, record: ITodo) => (
            <div onClick={() => handleEdit(record)} style={{ cursor: 'pointer' }}>
                <Text type="secondary" ellipsis={{ tooltip: text }} style={{ fontSize: 12 }}>
                    {text || '—'}
                </Text>
            </div>
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
        // ... (render logic remains the same)
        const s = status || 'pending';
        const statusMap: any = {
          pending: { label: 'To Do', color: '#8c8c8c', key: 'pending', bg: 'rgba(255,255,255,0.1)' },
          'in-progress': { label: 'In Progress', color: '#fff', key: 'in-progress', bg: '#1890ff' },
          completed: { label: 'Done', color: '#fff', key: 'completed', bg: '#52c41a' }
        };
        const current = statusMap[s] || statusMap.pending;

        const menu = (
          <div style={{ 
              background: isDark ? '#1d2633' : '#fff', 
              padding: '8px 0', 
              borderRadius: 8, 
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              minWidth: 160,
              boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            {Object.values(statusMap).map((item: any) => (
              <div 
                key={item.key}
                onClick={(e) => {
                  e.stopPropagation();
                  const newProgress = item.key === 'completed' ? 100 : (record.status === 'completed' ? 0 : record.progress);
                  dispatch(updateTodo({ id: record._id, data: { status: item.key, progress: newProgress } }));
                }}
                style={{ 
                    padding: '8px 16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    color: '#fff',
                    transition: 'background 0.2s'
                }}
                className="status-menu-item"
              >
                <Space size={12}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                  <Text style={{ color: isDark ? '#fff' : '#262626' }}>{item.label}</Text>
                </Space>
                {s === item.key && (
                  <Text style={{ color: '#2f80ed', fontSize: 12, fontWeight: 600 }}>● Current</Text>
                )}
              </div>
            ))}
          </div>
        );

        return (
          <Dropdown overlay={menu} trigger={['click']} placement="bottomCenter">
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
        // ... (render logic)
        const p = priority || 'medium';
        const priorityMap: any = {
          low: { label: 'Low', color: '#52c41a', key: 'low', icon: <MinusOutlined />, bg: '#52c41a' },
          medium: { label: 'Medium', color: '#1890ff', key: 'medium', icon: <span style={{ fontWeight: 'bold' }}>=</span>, bg: '#1890ff' },
          high: { label: 'High', color: '#fa8c16', key: 'high', icon: <div style={{ transform: 'rotate(90deg)', display: 'inline-block' }}>{'>>'}</div>, bg: '#fa8c16' },
          urgent: { label: 'Urgent', color: '#f5222d', key: 'urgent', icon: <CaretUpFilled />, bg: '#f5222d' }
        };
        const current = priorityMap[p] || priorityMap.medium;

        const menu = (
          <div style={{ 
              background: isDark ? '#1d2633' : '#fff', 
              padding: '8px 0', 
              borderRadius: 8, 
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              minWidth: 160,
              boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            {Object.values(priorityMap).map((item: any) => (
              <div 
                key={item.key}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(updateTodo({ id: record._id, data: { priority: item.key } }));
                }}
                style={{ 
                    padding: '8px 16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12,
                    cursor: 'pointer',
                    color: '#fff',
                    transition: 'background 0.2s'
                }}
                className="status-menu-item"
              >
                <div style={{ width: 20, display: 'flex', justifyContent: 'center', color: 'rgba(255,255,255,0.6)' }}>
                    {item.icon}
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                <Text style={{ color: isDark ? '#fff' : '#262626', flex: 1 }}>{item.label}</Text>
                {p === item.key && (
                  <Text style={{ color: '#2f80ed', fontSize: 11 }}>●</Text>
                )}
              </div>
            ))}
          </div>
        );

        return (
          <Dropdown overlay={menu} trigger={['click']} placement="bottomCenter">
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
          const dA = a.due_date ? new Date(a.due_date).getTime() : 0;
          const dB = b.due_date ? new Date(b.due_date).getTime() : 0;
          return dA - dB;
      },
      render: (date: string, record: ITodo) => {
        // ...
          if (!date) return <Text type="secondary" onClick={() => handleEdit(record)} style={{ cursor: 'pointer' }}>No date</Text>;
          const isOverdue = moment(date).isBefore(moment(), 'day') && record.status !== 'completed';
          return (
              <div onClick={() => handleEdit(record)} style={{ cursor: 'pointer' }}>
                  <Text style={{ 
                      color: isOverdue ? '#ff4d4f' : (isDark ? '#d9d9d9' : '#595959'), 
                      fontWeight: isOverdue ? 600 : 400 
                  }}>
                      {moment(date).format('MMM DD, YYYY')}
                  </Text>
              </div>
          );
      }
    },
    {
        title: 'Performance',
        key: 'performance',
        width: 140,
        render: (_: any, record: ITodo) => {
          if (record.status === 'completed' && record.performance) {
            const { on_time, overdue_days } = record.performance;
            return <Tag color={on_time ? 'success' : 'error'} style={{ borderRadius: 12 }}>{on_time ? 'ON TIME' : `LATE (${overdue_days}d)`}</Tag>;
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
        render: (date: string) => date ? <Text type="secondary" style={{ fontSize: 12 }}>{moment(date).format('MMM DD, HH:mm')}</Text> : <Text type="secondary">—</Text>
    },
    {
      title: 'Last Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      sorter: (a: ITodo, b: ITodo) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
      render: (date: string) => <Text type="secondary" style={{ fontSize: 11 }}>{moment(date).fromNow()}</Text>
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
          columns={columns} 
          dataSource={todos} 
          loading={loading}
          rowKey="_id"
          pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 2200 }}
          rowClassName={(record) => {
            const classes = [];
            if (record.is_overdue) classes.push(isDark ? 'todo-row-overdue-dark' : 'todo-row-overdue');
            if (record.status === 'completed') classes.push('todo-row-completed');
            return classes.join(' ');
          }}
          style={{ cursor: 'default' }}
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
      `}</style>
      <style>{`
        .status-menu-item:hover {
            background: rgba(255,255,255,0.05);
        }
        .status-select .ant-select-selector {
            padding: 0 !important;
        }
      `}</style>
    </div>
  );
};

export default TodoPage;

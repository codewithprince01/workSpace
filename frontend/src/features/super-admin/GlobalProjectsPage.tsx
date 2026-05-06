import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Input, Select, Button, Avatar, Tag, Tooltip, Space, Typography,
  Spin, Empty, Badge, Progress, Tabs, message
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, FolderOpenOutlined, TeamOutlined,
  CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, RightOutlined, ExpandOutlined, EyeOutlined,
  ProjectOutlined, UserOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import { createPortal } from 'react-dom';
import ProjectDrawer from '@/components/projects/project-drawer/project-drawer';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setProjectId, setProjectData, toggleProjectDrawer } from '@/features/project/project-drawer.slice';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { superAdminApiService, IGlobalProject, IGlobalTask } from '@/api/super-admin/super-admin.api.service';
import moment from 'moment';

const { Title, Text } = Typography;

// ─── helpers ─────────────────────────────────────────────────────────────────
const getColorFromName = (name: string) => {
  const colors = ['#f56a00','#7265e6','#ffbf00','#00a2ae','#1890ff','#52c41a','#eb2f96','#fa8c16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const StatusBadge: React.FC<{ status: string; statusColor?: string }> = ({ status, statusColor }) => {
  const lower = (status || '').toLowerCase();
  const presetMap: Record<string, { color: string; icon: React.ReactNode }> = {
    'to do':      { color: '#8c8c8c', icon: <ClockCircleOutlined /> },
    'todo':       { color: '#8c8c8c', icon: <ClockCircleOutlined /> },
    'in progress':{ color: '#1890ff', icon: <ExclamationCircleOutlined /> },
    'in-progress':{ color: '#1890ff', icon: <ExclamationCircleOutlined /> },
    'done':       { color: '#52c41a', icon: <CheckCircleOutlined /> },
    'completed':  { color: '#52c41a', icon: <CheckCircleOutlined /> },
  };
  const preset = presetMap[lower];
  const color = statusColor || preset?.color || '#8c8c8c';
  const icon = preset?.icon || <ClockCircleOutlined />;
  return (
    <Tag color={color} icon={icon} style={{ borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
      {status || 'To Do'}
    </Tag>
  );
};

const PriorityTag: React.FC<{ priority: string }> = ({ priority }) => {
  const map: Record<string, string> = { low: 'green', medium: 'blue', high: 'orange', urgent: 'red' };
  return <Tag color={map[priority] || 'default'} style={{ textTransform: 'capitalize', borderRadius: 10 }}>{priority}</Tag>;
};

const AssigneeGroup: React.FC<{ assignees: IGlobalTask['assignees'] }> = ({ assignees }) => (
  <Avatar.Group maxCount={3} size="small">
    {assignees.map(a => (
      <Tooltip key={a.id} title={a.name}>
        <Avatar src={a.avatar} style={{ background: getColorFromName(a.name), fontSize: 11, fontWeight: 600 }}>
          {a.name[0]?.toUpperCase()}
        </Avatar>
      </Tooltip>
    ))}
  </Avatar.Group>
);

// ─── Expandable row content ───────────────────────────────────────────────────
const ProjectTasksExpand: React.FC<{ projectId: string; projectName: string }> = ({ projectId, projectName }) => {
  const [tab, setTab] = useState<'today' | 'all'>('today');
  const [tasks, setTasks] = useState<IGlobalTask[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const themeMode = useAppSelector(s => s.themeReducer.mode);
  const isDark = themeMode === 'dark';

  const load = useCallback(async (todayOnly: boolean) => {
    setLoading(true);
    try {
      const res = await superAdminApiService.getProjectTasks(projectId, todayOnly);
      setTasks(res.body || []);
    } catch {
      message.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(tab === 'today'); }, [tab, load]);

  const taskColumns = [
    {
      title: 'Task',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      render: (name: string) => <Text strong style={{ fontSize: 13, color: isDark ? '#fff' : '#262626' }}>{name}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (s: string, r: IGlobalTask) => <StatusBadge status={s} statusColor={r.status_color} />,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (p: string) => <PriorityTag priority={p} />,
    },
    {
      title: 'Assignees',
      dataIndex: 'assignees',
      key: 'assignees',
      width: 120,
      render: (assignees: IGlobalTask['assignees']) =>
        assignees?.length ? <AssigneeGroup assignees={assignees} /> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 120,
      render: (d: string | null) => d ? (
        <Text style={{ fontSize: 12, color: moment(d).isBefore(moment(), 'day') ? '#ff4d4f' : (isDark ? '#ccc' : undefined) }}>
          {moment(d).format('MMM D, YYYY')}
        </Text>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      width: 110,
      render: (v: number) => <Progress percent={v} size="small" style={{ margin: 0 }} />,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (d: string) => <Text style={{ fontSize: 12 }} type="secondary">{moment(d).fromNow()}</Text>,
    },
  ];

  return (
    <div style={{
      padding: '16px 24px 16px 48px',
      background: isDark ? '#141414' : '#fff', 
      borderTop: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Tabs
          size="small"
          activeKey={tab}
          onChange={k => setTab(k as 'today' | 'all')}
          tabBarStyle={{ marginBottom: 0 }}
          items={[
            { key: 'today', label: <span><CalendarOutlined /> Today's Tasks</span> },
            { key: 'all', label: <span><ExpandOutlined /> All Tasks</span> },
          ]}
        />
        <Button
          type="primary"
          size="small"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate(`/workspace/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list`)}
        >
          Open Full Project
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
      ) : tasks.length === 0 ? (
        <Empty
          description={tab === 'today' ? 'No tasks due today' : 'No tasks in this project'}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Table
          dataSource={tasks}
          columns={taskColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
          scroll={{ x: 900 }}
          style={{
            borderRadius: 8,
            overflow: 'hidden',
            background: isDark ? '#1f1f1f' : '#fff',
            border: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
          }}
        />
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const GlobalProjectsPage: React.FC = () => {
  const isSuperAdmin = useAppSelector(s => s.superAdminReducer.isSuperAdmin);
  const themeMode = useAppSelector(s => s.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [projects, setProjects] = useState<IGlobalProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminApiService.getAllProjects({
        search: search || undefined,
        team_id: teamFilter === 'all' ? undefined : teamFilter,
        page,
        limit: 20,
      });
      setProjects(res.body || []);
      setTotal(res.total || 0);

      // build team list for filter
      const uniqueTeams = Array.from(
        new Map((res.body || []).map(p => [p.team_id, { id: p.team_id!, name: p.team_name }])).values()
      ).filter(t => t.id);
      setTeams(prev => {
        const existing = new Map(prev.map(t => [t.id, t]));
        uniqueTeams.forEach(t => existing.set(t.id, t));
        return Array.from(existing.values());
      });
    } catch {
      message.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [search, teamFilter, page]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  if (!isSuperAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Empty description="Access Denied — Super Admin only" />
      </div>
    );
  }

  const columns = [
    {
      title: 'Project',
      dataIndex: 'name',
      key: 'name',
      width: 260,
      fixed: 'left' as const,
      render: (name: string, record: IGlobalProject) => (
        <Space>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: record.color_code, flexShrink: 0,
          }} />
          <Button
            type="link"
            style={{ padding: 0, fontWeight: 600, fontSize: 14, color: isDark ? '#4096ff' : '#1677ff' }}
            onClick={() => navigate(`/workspace/projects/${record.id}?tab=tasks-list&pinned_tab=tasks-list`)}
          >
            {name}
          </Button>
        </Space>
      ),
    },
    {
      title: 'Organization',
      dataIndex: 'team_name',
      key: 'team_name',
      width: 180,
      render: (name: string, record: IGlobalProject) => (
        <Space size={6}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: record.team_color, flexShrink: 0,
          }} />
          <Tag color="blue" style={{ borderRadius: 10, fontSize: 12 }}>{name}</Tag>
        </Space>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'owner_name',
      key: 'owner_name',
      width: 180,
      render: (name: string, record: IGlobalProject) => (
        <Space size={8}>
          <Avatar
            src={record.owner_avatar}
            size="small"
            style={{ background: getColorFromName(name), fontSize: 11 }}
          >
            {name[0]?.toUpperCase()}
          </Avatar>
          <div>
            <Text style={{ fontSize: 13, fontWeight: 500 }}>{name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{record.owner_email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Tasks',
      dataIndex: 'total_tasks',
      key: 'total_tasks',
      width: 90,
      align: 'center' as const,
      sorter: (a: IGlobalProject, b: IGlobalProject) => a.total_tasks - b.total_tasks,
      render: (n: number) => (
        <Badge
          count={n}
          style={{ backgroundColor: n > 0 ? '#1890ff' : '#d9d9d9', fontSize: 12 }}
          overflowCount={999}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => {
        const map: Record<string, string> = { active: 'green', archived: 'orange', completed: 'blue' };
        return <Tag color={map[s] || 'default'} style={{ textTransform: 'capitalize', borderRadius: 10 }}>{s}</Tag>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      sorter: (a: IGlobalProject, b: IGlobalProject) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (d: string) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{moment(d).format('MMM D, YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{moment(d).fromNow()}</Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      align: 'center' as const,
      render: (_: unknown, record: IGlobalProject) => (
        <Space>
          <Tooltip title="Open Full Project">
            <Button
              type="primary"
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => navigate(`/workspace/projects/${record.id}?tab=tasks-list&pinned_tab=tasks-list`)}
            >
              Open
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#141414' : '#fff',
      position: 'relative',
    }}>
      <div style={{ width: '100%', margin: '0', padding: '24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Space align="center" style={{ marginBottom: 4 }}>
              <ProjectOutlined style={{ fontSize: 22, color: '#6366f1' }} />
              <Title level={3} style={{ margin: 0, color: isDark ? '#fff' : '#1a1a2e' }}>
                Global Projects
              </Title>
              <Tag color="purple" style={{ borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                SUPER ADMIN
              </Tag>
            </Space>
            <Text type="secondary">View and manage all projects across every organization in the system.</Text>
          </div>
          <Space size={12}>
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={loadProjects}
              style={{
                borderRadius: '50%', height: 40, width: 40,
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isDark ? '#fff' : '#1a1a2e'
              }}
            />
            <Button
              type="primary"
              icon={<ProjectOutlined />}
              onClick={() => {
                dispatch(setProjectId(null));
                dispatch(setProjectData({} as IProjectViewModel));
                dispatch(toggleProjectDrawer());
              }}
              style={{
                borderRadius: 8,
                height: 40,
                background: '#1677ff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(22,119,255,0.2)',
                fontWeight: 600,
              }}
            >
              Create Project
            </Button>
          </Space>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Projects', value: total, color: '#6366f1', icon: <ProjectOutlined /> },
            { label: 'Organizations', value: teams.length, color: '#1890ff', icon: <TeamOutlined /> },
            { label: 'Shown', value: projects.length, color: '#52c41a', icon: <EyeOutlined /> },
          ].map(stat => (
            <div key={stat.label} style={{
              background: isDark ? '#1f1f1f' : '#fff',
              border: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
              borderRadius: 12, padding: '14px 20px',
              display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 160px',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${stat.color}20`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18, color: stat.color,
              }}>
                {stat.icon}
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>{stat.label}</Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, lineHeight: 1.2 }}>
                  {stat.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{
          background: 'transparent',
          border: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
          borderRadius: '12px 12px 0 0', padding: '12px 16px',
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          borderBottom: 'none',
        }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Search projects..."
            style={{
              width: 280, borderRadius: 8, height: 36,
              background: isDark ? '#141414' : '#fff',
              border: isDark ? '1px solid #303030' : undefined,
            }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            allowClear
          />
          <Select
            value={teamFilter}
            onChange={v => { setTeamFilter(v); setPage(1); }}
            style={{ width: 200 }}
            placeholder="Filter by Organization"
            options={[
              { value: 'all', label: 'All Organizations' },
              ...teams.map(t => ({ value: t.id, label: t.name })),
            ]}
          />
          {(search || teamFilter !== 'all') && (
            <Button type="link" size="small" onClick={() => { setSearch(''); setTeamFilter('all'); setPage(1); }}>
              Reset
            </Button>
          )}
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            {total} project{total !== 1 ? 's' : ''} found
          </Text>
        </div>

        {/* Projects Table */}
        <Table
          dataSource={projects}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
          style={{
            background: 'transparent',
            border: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            overflow: 'hidden',
          }}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`,
          }}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpand: (expanded, record) => {
              setExpandedKeys(expanded
                ? [...expandedKeys, record.id]
                : expandedKeys.filter(k => k !== record.id)
              );
            },
            expandedRowRender: (record: IGlobalProject) => (
              <ProjectTasksExpand projectId={record.id} projectName={record.name} />
            ),
            expandIcon: ({ expanded, onExpand, record }) => (
              <Button
                type="text"
                size="small"
                icon={<RightOutlined rotate={expanded ? 90 : 0} style={{ transition: 'all 0.2s', color: '#6366f1' }} />}
                onClick={e => onExpand(record, e)}
                style={{ padding: '0 4px' }}
              />
            ),
          }}
          rowClassName={() => 'global-project-row'}
        />

        <style>{`
          .global-project-row:hover td { background: ${isDark ? 'rgba(99,102,241,0.05)' : '#f5f5ff'} !important; }
          .global-project-row td { transition: background 0.2s; }
          .ant-table-expanded-row > td {
            background: ${isDark ? '#141414' : '#fff'} !important;
            padding: 0 !important;
          }
          .ant-table-expanded-row-fixed {
            background: ${isDark ? '#141414' : '#fff'} !important;
          }
        `}</style>
      </div>
      {createPortal(<ProjectDrawer onClose={() => {}} />, document.body, 'project-drawer')}
    </div>
  );
};

export default GlobalProjectsPage;

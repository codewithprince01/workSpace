import React, { useEffect, useState } from 'react';
import './super-admin.css';
import {
  Modal,
  Input,
  List,
  Avatar,
  Tag,
  Space,
  Typography,
  Spin,
  Switch,
  Divider,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  SwapOutlined,
  EyeOutlined,
  EditOutlined,
  TeamOutlined,
  UserOutlined,
  CheckCircleFilled,
  LogoutOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchAllTeams,
  switchOrg,
  exitOrg,
  toggleManageMode,
  closeOrgSwitcher,
} from '@/features/super-admin/superAdminSlice';
import { ISuperAdminTeam } from '@/api/super-admin/super-admin.api.service';

const { Text, Title } = Typography;

/**
 * localStorage key used to persist the active super-admin org across page reloads.
 * The Navbar and other boot-time components read this to immediately show the
 * correct organisation name without waiting for the /super-admin/context API call.
 */
export const SUPER_ADMIN_ACTIVE_TEAM_KEY = 'sa_active_team_id';

const OrgSwitcherModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    orgSwitcherOpen,
    allTeams,
    allTeamsLoading,
    context,
    manageMode,
  } = useAppSelector(state => state.superAdminReducer);

  const [search, setSearch] = useState('');
  const [switchingTeamId, setSwitchingTeamId] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (orgSwitcherOpen) {
      dispatch(fetchAllTeams());
      setSearch('');
    }
  }, [orgSwitcherOpen, dispatch]);

  const filtered = allTeams.filter(
    team =>
      team.name.toLowerCase().includes(search.toLowerCase()) ||
      team.owner_name.toLowerCase().includes(search.toLowerCase()) ||
      team.owner_email.toLowerCase().includes(search.toLowerCase())
  );

  const isCurrentOrg = (team: ISuperAdminTeam) =>
    context?.active_team_id === team.id;

  /**
   * Full org switch — 3 steps:
   * 1. POST to backend: sets user.super_admin_active_team in DB.
   *    From that point every API request's protect() middleware will override
   *    req.user.last_team_id → target team, so ALL data queries filter correctly.
   * 2. Store team_id in localStorage so the Navbar shows the right org on reload.
   * 3. Hard redirect to /workspace/home — this destroys all in-memory state
   *    (Redux, RTK Query cache, component state) and the app boots fresh with
   *    the target org's data already flowing from the backend.
   */
  const handleSwitch = async (team: ISuperAdminTeam) => {
    if (isCurrentOrg(team) || switchingTeamId) return;

    setSwitchingTeamId(team.id);
    try {
      const result = await dispatch(switchOrg(team.id));
      if (switchOrg.fulfilled.match(result)) {
        localStorage.setItem(SUPER_ADMIN_ACTIVE_TEAM_KEY, team.id);
        // Full page navigation wipes all cached state and forces clean boot
        window.location.href = '/workspace/home';
      }
    } finally {
      setSwitchingTeamId(null);
    }
  };

  /**
   * Exit org context — removes the DB flag via API, clears localStorage,
   * then reloads back to the super admin's own workspace.
   */
  const handleExit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      const result = await dispatch(exitOrg());
      if (exitOrg.fulfilled.match(result)) {
        localStorage.removeItem(SUPER_ADMIN_ACTIVE_TEAM_KEY);
        window.location.href = '/workspace/home';
      }
    } finally {
      setExiting(false);
    }
  };

  const handleToggleMode = (checked: boolean) => {
    dispatch(toggleManageMode(checked));
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';

  return (
    <Modal
      open={orgSwitcherOpen}
      onCancel={() => dispatch(closeOrgSwitcher())}
      footer={null}
      title={
        <Space align="center" size={10}>
          <SwapOutlined style={{ color: '#6366f1', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0, color: '#6366f1' }}>
            Switch Organization
          </Title>
        </Space>
      }
      width={560}
      styles={{
        header: {
          borderBottom: isDark ? '1px solid #303030' : '1px solid rgba(99,102,241,0.15)',
          paddingBottom: 12,
          background: isDark ? '#1f1f1f' : 'linear-gradient(135deg, #f0f0ff 0%, #fff 100%)',
        },
        body: { 
          padding: 0,
          background: isDark ? '#1f1f1f' : '#fff'
        },
      }}
      style={{ top: 80 }}
      className={isDark ? 'sa-modal-dark' : ''}
    >
      {/* ── View / Manage Mode Toggle ────────────────────────────────────── */}
      {context?.active_team_id && (
        <div
          style={{
            padding: '12px 20px',
            background: manageMode
              ? (isDark ? '#2a1215' : 'linear-gradient(90deg, #fff1f0 0%, #fff 100%)')
              : (isDark ? '#122312' : 'linear-gradient(90deg, #f6ffed 0%, #fff 100%)'),
            borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Space>
            {manageMode ? (
              <EditOutlined style={{ color: '#ff4d4f' }} />
            ) : (
              <EyeOutlined style={{ color: '#52c41a' }} />
            )}
            <Text strong style={{ color: manageMode ? '#ff4d4f' : '#52c41a' }}>
              {manageMode ? 'Manage Mode — Can Edit Data' : 'View Mode — Read Only'}
            </Text>
          </Space>
          <Tooltip
            title={
              manageMode
                ? 'Switch to read-only view mode'
                : 'Switch to manage mode (allows editing)'
            }
          >
            <Switch
              size="small"
              checked={manageMode}
              onChange={handleToggleMode}
              checkedChildren={<EditOutlined />}
              unCheckedChildren={<EyeOutlined />}
              style={{ backgroundColor: manageMode ? '#ff4d4f' : '#52c41a' }}
            />
          </Tooltip>
        </div>
      )}

      {/* ── Currently Active Org Banner ──────────────────────────────────── */}
      {context?.active_team_id && (
        <div
          style={{
            padding: '10px 20px',
            background: isDark ? '#1a1425' : '#f9f0ff',
            borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space>
            <CheckCircleFilled style={{ color: '#9254de' }} />
            <Text style={{ color: isDark ? '#efdbff' : '#722ed1' }}>
              Currently viewing: <strong style={{ color: isDark ? '#fff' : 'inherit' }}>{context.active_team_name}</strong>
            </Text>
          </Space>
          <Tag
            icon={exiting ? <LoadingOutlined /> : <LogoutOutlined />}
            color="purple"
            onClick={handleExit}
            style={{ cursor: exiting ? 'not-allowed' : 'pointer', borderRadius: 20 }}
          >
            {exiting ? 'Exiting…' : 'Exit Org'}
          </Tag>
        </div>
      )}

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 20px 8px', background: isDark ? '#1f1f1f' : '#fff' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#aaa' }} />}
          placeholder="Search organizations or owners…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          size="large"
          style={{ 
            borderRadius: 8,
            background: isDark ? '#141414' : '#fff',
            border: isDark ? '1px solid #303030' : undefined
          }}
          autoFocus
        />
      </div>

      {/* ── Teams List ──────────────────────────────────────────────────── */}
      <div style={{ 
        maxHeight: 400, 
        overflowY: 'auto', 
        padding: '0 20px 16px',
        background: isDark ? '#1f1f1f' : '#fff' 
      }}>
        {allTeamsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : (
          <List
            dataSource={filtered}
            locale={{ emptyText: <Text type="secondary">No organizations found</Text> }}
            renderItem={team => {
              const active = isCurrentOrg(team);
              const loading = switchingTeamId === team.id;
              return (
                <List.Item
                  key={team.id}
                  onClick={() => handleSwitch(team)}
                  style={{
                    cursor: active || loading ? 'default' : 'pointer',
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 4,
                    background: active
                      ? (isDark ? '#2d1b4d' : 'linear-gradient(90deg, #f9f0ff 0%, #faf5ff 100%)')
                      : 'transparent',
                    border: active 
                      ? (isDark ? '1.5px solid #722ed1' : '1.5px solid #d3adf7') 
                      : '1.5px solid transparent',
                    transition: 'all 0.15s ease',
                    opacity: loading ? 0.7 : 1,
                  }}
                  className={active ? '' : 'hover-org-row'}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size={42}
                        style={{
                          background: team.color_code || '#6366f1',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(team.name)}
                      </Avatar>
                    }
                    title={
                      <Space size={6}>
                        <Text strong style={{ fontSize: 14, color: isDark ? '#fff' : 'inherit' }}>
                          {team.name}
                        </Text>
                        {active && (
                          <Tag color="purple" style={{ borderRadius: 20, fontSize: 11 }}>
                            Active
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Space size={4}>
                        <UserOutlined style={{ fontSize: 11, color: isDark ? '#888' : '#999' }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {team.owner_name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          · {team.owner_email}
                        </Text>
                      </Space>
                    }
                  />
                  {loading ? (
                    <Spin size="small" indicator={<LoadingOutlined spin />} />
                  ) : !active ? (
                    <Tag
                      color="geekblue"
                      style={{ cursor: 'pointer', borderRadius: 20, fontSize: 11 }}
                    >
                      Switch
                    </Tag>
                  ) : null}
                </List.Item>
              );
            }}
          />
        )}
      </div>

      <Divider style={{ margin: 0, borderColor: isDark ? '#303030' : undefined }} />
      <div style={{ padding: '10px 20px', textAlign: 'center', background: isDark ? '#1f1f1f' : '#fff' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <TeamOutlined /> {filtered.length} of {allTeams.length} organizations
        </Text>
      </div>
    </Modal>
  );
};

export default OrgSwitcherModal;

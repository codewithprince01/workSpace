import React from 'react';
import { Space, Tag, Typography, Tooltip, Switch, Button } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  SwapOutlined,
  CloseCircleOutlined,
  CrownFilled,
} from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  openOrgSwitcher,
  exitOrg,
  toggleManageMode,
} from '@/features/super-admin/superAdminSlice';

const { Text } = Typography;

/**
 * SuperAdminBar — a slim, sticky banner shown when a super admin
 * is currently viewing a foreign organization's context.
 * Positioned below the navbar via fixed positioning.
 */
const SuperAdminBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isSuperAdmin, context, manageMode } = useAppSelector(
    state => state.superAdminReducer
  );

  // Only render for super admins who are viewing a foreign org
  if (!isSuperAdmin) return null;
  if (!context?.active_team_id) return null;

  const isInForeignOrg = context.active_team_id !== context.own_team_id;
  if (!isInForeignOrg) return null;

  const handleExit = () => {
    dispatch(exitOrg());
  };

  const handleToggleMode = (checked: boolean) => {
    dispatch(toggleManageMode(checked));
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 64, // below the 64px navbar
        zIndex: 998,
        background: manageMode
          ? 'linear-gradient(90deg, #fff1f0 0%, #fff7f7 50%, #fff1f0 100%)'
          : 'linear-gradient(90deg, #f0f4ff 0%, #f5f0ff 50%, #f0f4ff 100%)',
        borderBottom: `2px solid ${manageMode ? '#ff7875' : '#9254de'}`,
        padding: '5px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(8px)',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Left: Identity */}
      <Space size={8} wrap>
        <CrownFilled style={{ color: manageMode ? '#ff4d4f' : '#6366f1', fontSize: 15 }} />
        <Text style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>
          Super Admin
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Viewing:
        </Text>
        <Tag
          color="purple"
          style={{ borderRadius: 20, fontWeight: 700, fontSize: 12 }}
        >
          {context.active_team_name}
        </Tag>

        {/* Mode badge */}
        {manageMode ? (
          <Tag
            icon={<EditOutlined />}
            color="error"
            style={{ borderRadius: 20, fontWeight: 600 }}
          >
            Manage Mode
          </Tag>
        ) : (
          <Tag
            icon={<EyeOutlined />}
            color="success"
            style={{ borderRadius: 20, fontWeight: 600 }}
          >
            View Only
          </Tag>
        )}
      </Space>

      {/* Right: Controls */}
      <Space size={12} wrap>
        {/* Mode toggle */}
        <Tooltip
          title={
            manageMode
              ? 'Click to switch to read-only view mode'
              : 'Click to enable manage mode (allows editing org data)'
          }
        >
          <Space size={6}>
            <EyeOutlined style={{ color: manageMode ? '#ccc' : '#52c41a' }} />
            <Switch
              size="small"
              checked={manageMode}
              onChange={handleToggleMode}
              style={{ backgroundColor: manageMode ? '#ff4d4f' : '#52c41a' }}
            />
            <EditOutlined style={{ color: manageMode ? '#ff4d4f' : '#ccc' }} />
          </Space>
        </Tooltip>

        {/* Switch org */}
        <Tooltip title="Switch to a different organization">
          <Button
            size="small"
            icon={<SwapOutlined />}
            onClick={() => dispatch(openOrgSwitcher())}
            style={{
              borderRadius: 20,
              borderColor: '#6366f1',
              color: '#6366f1',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Switch Org
          </Button>
        </Tooltip>

        {/* Exit */}
        <Tooltip title="Return to your own workspace">
          <Button
            size="small"
            type="primary"
            danger={manageMode}
            icon={<CloseCircleOutlined />}
            onClick={handleExit}
            style={{ borderRadius: 20, fontWeight: 600, fontSize: 12 }}
          >
            Exit Org
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
};

export default SuperAdminBar;

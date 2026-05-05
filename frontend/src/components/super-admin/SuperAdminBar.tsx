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
  const { isSuperAdmin, context } = useAppSelector(
    state => state.superAdminReducer
  );
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';

  // Only render for super admins who are viewing a foreign org
  if (!isSuperAdmin) return null;
  if (!context?.active_team_id) return null;

  const isInForeignOrg = context.active_team_id !== context.own_team_id;
  if (!isInForeignOrg) return null;

  const handleExit = () => {
    dispatch(exitOrg());
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 64, // below the 64px navbar
        zIndex: 998,
        background: isDark ? '#1f1f1f' : '#f0f2f5',
        borderBottom: `1px solid ${isDark ? '#303030' : '#d9d9d9'}`,
        padding: '4px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        gap: 12,
      }}
    >
      {/* Left: Identity */}
      <Space size={8}>
        <CrownFilled style={{ color: '#6366f1', fontSize: 14 }} />
        <Text strong style={{ fontSize: 12, color: isDark ? '#fff' : '#434343', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Super Admin
        </Text>
        <div style={{ height: 14, width: 1, background: isDark ? '#434343' : '#d9d9d9', margin: '0 4px' }} />
        <Text style={{ fontSize: 13, color: isDark ? '#aaa' : '#8c8c8c' }}>
          Viewing Organization:
        </Text>
        <Tag
          color="blue"
          style={{ borderRadius: 4, fontWeight: 600, fontSize: 12, border: 'none' }}
        >
          {context.active_team_name}
        </Tag>
      </Space>

      {/* Right: Controls */}
      <Space size={12}>
        {/* Switch org */}
        <Button
          size="small"
          type="text"
          icon={<SwapOutlined />}
          onClick={() => dispatch(openOrgSwitcher())}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#6366f1',
          }}
        >
          Switch
        </Button>

        {/* Exit Icon Only */}
        <Tooltip title="Exit organization context">
          <Button
            size="small"
            type="text"
            icon={<CloseCircleOutlined style={{ fontSize: 18 }} />}
            onClick={handleExit}
            danger
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: 4
            }}
          />
        </Tooltip>
      </Space>
    </div>
  );
};

export default SuperAdminBar;

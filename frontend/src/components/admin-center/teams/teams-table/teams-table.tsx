import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import Avatars from '@/components/avatars/avatars';
import SettingTeamDrawer from '@/components/admin-center/teams/settings-drawer/settings-drawer';
import { toggleSettingDrawer, deleteTeam, fetchTeams } from '@/features/teams/teamSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IOrganizationTeam } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { SettingOutlined, DeleteOutlined } from '@/shared/antd-imports';
import { Badge, Button, Card, Popconfirm, Table, TableProps, Tooltip, Typography, Flex } from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';

interface TeamsTableProps {
  teams: IOrganizationTeam[];
  currentTeam: IOrganizationTeam | null;
  t: TFunction;
  loading: boolean;
  reloadTeams: () => void;
}

const TeamsTable: React.FC<TeamsTableProps> = ({
  teams,
  currentTeam = null,
  t,
  loading,
  reloadTeams,
}) => {
  const dispatch = useAppDispatch();
  const isTablet = useMediaQuery({ query: '(min-width: 1000px)' });
  const [deleting, setDeleting] = useState(false);
  const [isSettingDrawerOpen, setIsSettingDrawerOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handleTeamDelete = async (teamId: string) => {
    if (!teamId) return;
    try {
      setDeleting(true);
      const res = await adminCenterApiService.deleteTeam(teamId);
      if (res.done) {
        reloadTeams();
        dispatch(fetchTeams());
      }
    } catch (error) {
      logger.error('Error deleting team', error);
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableProps<IOrganizationTeam>['columns'] = [
    {
      title: t('team'),
      key: 'teamName',
      render: (record: IOrganizationTeam) => (
        <Typography.Text style={{ fontSize: `${isTablet ? '14px' : '12px'}`, color: themeWiseColor('#262626', '#fafafa', themeMode), fontWeight: 500 }}>
          <Badge
            status={currentTeam?.id === record.id ? 'success' : 'default'}
            style={{ marginRight: '8px' }}
          />
          {record.name}
        </Typography.Text>
      ),
    },
    {
      title: <span style={{ display: 'flex', justifyContent: 'center' }}>{t('membersCount')}</span>,
      key: 'membersCount',
      render: (record: IOrganizationTeam) => (
        <Typography.Text
          style={{
            display: 'flex',
            justifyContent: 'center',
            fontSize: `${isTablet ? '14px' : '12px'}`,
            color: themeWiseColor('#595959', '#bfbfbf', themeMode)
          }}
        >
          {record.members_count || 0}
        </Typography.Text>
      ),
    },
    {
      title: t('members'),
      key: 'members',
      render: (record: IOrganizationTeam) => (
        <span>
          <Avatars members={record.names || []} />
        </span>
      ),
    },
    {
      title: '',
      key: 'button',
      render: (record: IOrganizationTeam) => (
        <div className="row-buttons" style={{ display: 'flex', justifyContent: 'right' }}>
          <Tooltip title={t('settings')}>
            <Button
              style={{ marginRight: '8px' }}
              size="small"
              type="text"
              onClick={() => {
                setSelectedTeam(record.id || '');
                setIsSettingDrawerOpen(true);
              }}
              icon={<SettingOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />}
            />
          </Tooltip>

          <Tooltip title={t('delete')}>
            <Popconfirm title={t('popTitle')} onConfirm={() => handleTeamDelete(record.id || '')}>
              <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />} />
            </Popconfirm>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <>
      <Table<IOrganizationTeam>
        rowClassName="team-table-row"
        size="large"
        columns={columns}
        dataSource={teams}
        rowKey={record => record.id || ''}
        loading={loading}
        pagination={{
            showSizeChanger: true,
            defaultPageSize: 20,
            pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
            size: 'small',
            position: ['bottomRight'],
            style: { padding: '16px 24px' }
        }}
        style={{ 
            backgroundColor: 'transparent'
        }}
      />
      <SettingTeamDrawer
        teamId={selectedTeam}
        isSettingDrawerOpen={isSettingDrawerOpen}
        setIsSettingDrawerOpen={setIsSettingDrawerOpen}
      />
      
      <style>{`
        .team-table-row:hover td {
          background-color: ${themeWiseColor('rgba(0, 0, 0, 0.02)', 'rgba(255, 255, 255, 0.02)', themeMode)} !important;
        }
        .ant-table {
          background: transparent !important;
        }
        .ant-table-thead > tr > th {
          background: transparent !important;
          color: ${themeWiseColor('#8c8c8c', '#bfbfbf', themeMode)} !important;
          border-bottom: 1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)} !important;
          font-weight: 500 !important;
          padding: 16px 24px !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)} !important;
          padding: 16px 24px !important;
        }
        .ant-table-tbody > tr:last-child > td {
          border-bottom: none !important;
        }
        .ant-pagination-item, .ant-pagination-prev, .ant-pagination-next, .ant-pagination-item-link {
            background: transparent !important;
            border-color: ${themeWiseColor('#d9d9d9', '#303030', themeMode)} !important;
        }
        .ant-pagination-item a {
            color: ${themeWiseColor('#8c8c8c', '#8c8c8c', themeMode)} !important;
        }
        .ant-pagination-item-active {
            border-color: #1890ff !important;
        }
        .ant-pagination-item-active a {
            color: #1890ff !important;
        }
      `}</style>
    </>
  );
};

export default TeamsTable;

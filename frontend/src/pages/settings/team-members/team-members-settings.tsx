import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
  SyncOutlined,
  UserSwitchOutlined,
  MoreOutlined,
  PushpinOutlined,
  ReloadOutlined,
} from '@/shared/antd-imports';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
  Dropdown,
  Menu,
  Space,
} from '@/shared/antd-imports';
import { createPortal } from 'react-dom';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import UpdateMemberDrawer from '@/components/settings/update-member-drawer';
import {
  toggleInviteMemberDrawer,
  toggleUpdateMemberDrawer,
} from '@features/settings/member/memberSlice';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { colors } from '@/styles/colors';

import { themeWiseColor } from '@/utils/themeWiseColor';

const TeamMembersSettings = () => {
  const { t } = useTranslation('settings/team-members');
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const refreshTeamMembers = useAppSelector(state => state.memberReducer.refreshTeamMembers);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  useDocumentTitle(t('title') || 'Team Members');

  const [model, setModel] = useState<ITeamMembersViewModel>({ total: 0, data: [] });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'asc',
  });

  const getTeamMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await teamMembersApiService.get(
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        searchQuery
      );
      if (res.done) {
        setModel(res.body);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination, searchQuery]);

  const handleStatusChange = async (record: ITeamMemberViewModel) => {
    try {
      setIsLoading(true);
      const res = await teamMembersApiService.toggleMemberActiveStatus(
        record.id || '',
        record.active as boolean,
        record.email || ''
      );
      if (res.done) {
        await getTeamMembers();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMember = async (record: ITeamMemberViewModel) => {
    if (!record.id) return;
    try {
      setIsLoading(true);
      const res = await teamMembersApiService.delete(record.id);
      if (res.done) {
        await getTeamMembers();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMemberUpdate = useCallback((memberId: string, updatedData: Partial<ITeamMemberViewModel>) => {
    setModel(prevModel => ({
      ...prevModel,
      data: prevModel.data?.map(member =>
        member.id === memberId ? { ...member, ...updatedData } : member
      ),
    }));
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    getTeamMembers().finally(() => setIsLoading(false));
  }, [getTeamMembers]);

  const handleMemberClick = useCallback(
    (memberId: string) => {
      setSelectedMemberId(memberId);
      dispatch(toggleUpdateMemberDrawer());
    },
    [dispatch]
  );

  const handleTableChange = useCallback((newPagination: any, filters: any, sorter: any) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
      field: (Array.isArray(sorter) ? sorter[0].field : sorter.field) || 'name',
      order: (Array.isArray(sorter) ? sorter[0].order : sorter.order) === 'ascend' ? 'asc' : 'desc',
    }));
  }, []);

  useEffect(() => {
    if (socket) {
      const handleRoleChange = (data: { memberId: string; role_name: string }) => {
        handleMemberUpdate(data.memberId, { role_name: data.role_name });
      };
      socket.on(SocketEvents.TEAM_MEMBER_ROLE_CHANGE.toString(), handleRoleChange);
      return () => {
        socket.off(SocketEvents.TEAM_MEMBER_ROLE_CHANGE.toString(), handleRoleChange);
      };
    }
  }, [socket, handleMemberUpdate]);

  useEffect(() => {
    handleRefresh();
  }, [refreshTeamMembers, handleRefresh]);

  useEffect(() => {
    getTeamMembers();
  }, [getTeamMembers]);

  const getColor = useCallback((role: string | undefined) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return '#0087f5'; // Vibrant blue for Owner
      case 'member':
        return '#909090'; // Light gray for Member
      default:
        return '#909090'; // Light gray default
    }
  }, []);

  const getActionMenu = (record: ITeamMemberViewModel) => {
    return {
      items: [
        {
          key: 'edit',
          label: t('editMemberText') || 'Edit member',
          icon: <EditOutlined />,
          onClick: () => record.id && handleMemberClick(record.id),
        },
        {
          key: 'status',
          label: record.active ? (t('deactivateMemberText') || 'Deactivate member') : (t('activateMemberText') || 'Activate member'),
          icon: <UserSwitchOutlined />,
          onClick: () => {
            Modal.confirm({
              title: record.active ? t('confirmDeactivateTitle') : t('confirmActivateTitle'),
              icon: <ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />,
              onOk: () => handleStatusChange(record),
            });
          },
        },
        {
          type: 'divider',
        },
        {
          key: 'delete',
          label: t('deleteMemberText') || 'Delete member',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => {
            Modal.confirm({
              title: t('confirmDeleteTitle'),
              icon: <ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />,
              onOk: () => record.id && handleDeleteMember(record),
            });
          },
        },
      ],
    };
  };

  const columns: TableProps['columns'] = [
    {
      key: 'name',
      dataIndex: 'name',
      title: 'Name',
      defaultSortOrder: 'ascend',
      sorter: true,
      render: (_, record: ITeamMemberViewModel) => (
        <Flex align="center" gap={12} onClick={() => handleMemberClick(record.id || '')} style={{ cursor: 'pointer' }}>
          <Avatar size={28} src={record.avatar_url} style={{ backgroundColor: record.color_code || '#87d068' }}>
            {record.name?.charAt(0)}
          </Avatar>
          <Flex align="center" gap={8}>
            <Typography.Text style={{ color: themeWiseColor('#262626', '#d1d1d1', themeMode), fontSize: 13 }}>
              {record.name}
            </Typography.Text>
            {record.is_online && <Badge color="#52c41a" />}
            {!record.active && (
              <Typography.Text style={{ color: '#f56a00', fontSize: 13 }}>
                (Currently Deactivated)
              </Typography.Text>
            )}
          </Flex>
        </Flex>
      ),
    },
    {
      key: 'projects_count',
      dataIndex: 'projects_count',
      title: 'Projects',
      sorter: true,
      render: (count) => <Typography.Text style={{ color: themeWiseColor('#262626', '#d1d1d1', themeMode), fontSize: 13 }}>{count || 0}</Typography.Text>,
    },
    {
      key: 'email',
      dataIndex: 'email',
      title: 'Email',
      sorter: true,
      render: (email, record) => (
        <Flex align="center" gap={8}>
          <Typography.Text style={{ color: themeWiseColor('#262626', '#d1d1d1', themeMode), fontSize: 13 }}>{email}</Typography.Text>
          {record.pending_invitation && (
            <Typography.Text style={{ fontSize: 12, color: '#707070' }}>
              (Invitation pending)
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      key: 'job_title',
      dataIndex: 'job_title',
      title: 'Job Title',
      sorter: true,
      render: (title) => (
        <Typography.Text style={{ color: '#909090', fontSize: 13, cursor: 'pointer' }}>
          {title || 'Select a Job Title'}
        </Typography.Text>
      ),
    },
    {
      key: 'role_name',
      dataIndex: 'role_name',
      title: 'Team Access',
      sorter: true,
      render: (role) => (
        <Typography.Text style={{ color: getColor(role), fontSize: 13, textTransform: 'capitalize' }}>
          {role}
        </Typography.Text>
      ),
    },
    {
      key: 'team_lead',
      title: 'Team Lead',
      render: (_, record) => (
        <Typography.Text style={{ color: '#909090', fontSize: 13 }}>
          {record.role_name === 'owner' ? '-' : 'Unassigned'}
        </Typography.Text>
      ),
    },
    {
      key: 'actions',
      width: 50,
      align: 'center',
      render: (_, record) => (
        record.role_name !== 'owner' && (
          <Dropdown menu={getActionMenu(record)} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined style={{ color: '#909090', fontSize: 18 }} />} />
          </Dropdown>
        )
      ),
    },
  ];

  const rowSelection = {
    onChange: (selectedRowKeys: React.Key[], selectedRows: ITeamMemberViewModel[]) => {
      console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
    },
  };

  return (
    <div style={{ padding: '24px 0', width: '100%', background: themeWiseColor('#ffffff', '#121212', themeMode), minHeight: '100vh' }}>
      <style>{`
        .ant-table {
          background: transparent !important;
        }
        .ant-table-thead > tr > th {
          background: transparent !important;
          color: ${themeWiseColor('#8c8c8c', '#909090', themeMode)} !important;
          border-bottom: 0.5px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)} !important;
          font-weight: 500 !important;
          font-size: 13px !important;
          padding: 12px 16px !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 0.5px solid ${themeWiseColor('#f0f0f0', '#202020', themeMode)} !important;
          padding: 12px 16px !important;
          background: transparent !important;
        }
        .ant-table-row:hover > td {
          background: ${themeWiseColor('rgba(0, 0, 0, 0.02)', 'rgba(255, 255, 255, 0.02)', themeMode)} !important;
        }
        .ant-card {
          background: ${themeWiseColor('#ffffff', '#1e1e1e', themeMode)} !important;
          border: 1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)} !important;
          border-radius: 8px !important;
        }
        .ant-input-affix-wrapper {
          background: ${themeWiseColor('#fafafa', '#121212', themeMode)} !important;
          border: 1px solid ${themeWiseColor('#d9d9d9', '#303030', themeMode)} !important;
          color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
          border-radius: 6px !important;
        }
        .ant-input {
          background: transparent !important;
          color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
          font-size: 13px !important;
        }
        .ant-btn-primary {
          background: #0087f5 !important;
          border-radius: 6px !important;
          font-weight: 500 !important;
          font-size: 13px !important;
        }
        .ant-pagination-item {
          background: transparent !important;
          border: 1px solid ${themeWiseColor('#d9d9d9', '#303030', themeMode)} !important;
        }
        .ant-pagination-item a {
          color: ${themeWiseColor('#595959', '#707070', themeMode)} !important;
        }
        .ant-pagination-item-active {
          background: #0087f5 !important;
          border-color: #0087f5 !important;
        }
        .ant-pagination-item-active a {
          color: #fff !important;
        }
        .ant-pagination-prev .ant-pagination-item-link,
        .ant-pagination-next .ant-pagination-item-link {
          background: transparent !important;
          border-color: ${themeWiseColor('#d9d9d9', '#303030', themeMode)} !important;
          color: ${themeWiseColor('#595959', '#707070', themeMode)} !important;
        }
        .ant-table-column-sorter {
          color: ${themeWiseColor('#d9d9d9', '#707070', themeMode)} !important;
        }
        .ant-checkbox-inner {
          background-color: transparent !important;
          border-color: ${themeWiseColor('#d9d9d9', '#404040', themeMode)} !important;
        }
        .ant-checkbox-checked .ant-checkbox-inner {
          background-color: #0087f5 !important;
          border-color: #0087f5 !important;
        }
        .ant-select-selector {
          background-color: ${themeWiseColor('#ffffff', '#2a2a2a', themeMode)} !important;
          border-color: ${themeWiseColor('#d9d9d9', '#404040', themeMode)} !important;
          color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
        }
      `}</style>

      <Flex align="center" justify="space-between" style={{ padding: '0 8px', marginBlockEnd: 24 }}>
        <Flex align="center" gap={16}>
          <Typography.Title level={4} style={{ margin: 0, color: themeWiseColor('#262626', '#fff', themeMode), fontWeight: 600 }}>
            {model.total} {model.total !== 1 ? t('membersCountPlural') : t('memberCount')}
          </Typography.Title>
          <Button 
            type="text" 
            shape="circle" 
            icon={<ReloadOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />} 
            onClick={handleRefresh}
            loading={isLoading}
            style={{ color: themeWiseColor('#595959', '#bfbfbf', themeMode) }}
          />
        </Flex>

        <Flex gap={12} align="center">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            style={{ width: 280, borderRadius: 8, backgroundColor: themeWiseColor('#fff', '#121212', themeMode), color: themeWiseColor('#262626', '#fff', themeMode), border: `1px solid ${themeWiseColor('#d9d9d9', '#303030', themeMode)}` }}
            prefix={<SearchOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />}
            className="premium-input"
          />
          <Button 
            type="primary" 
            size="large"
            onClick={() => dispatch(toggleInviteMemberDrawer())}
            style={{ padding: '0 24px' }}
          >
            {t('addMemberButton') || 'Add New Member'}
          </Button>
          <Tooltip title={t('pinTooltip')}>
            <Button 
              type="text" 
              icon={<PushpinOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode), fontSize: 20 }} />} 
            />
          </Tooltip>
        </Flex>
      </Flex>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          rowSelection={rowSelection}
          dataSource={model.data}
          rowKey={record => record.id || ''}
          onChange={handleTableChange}
          loading={isLoading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: model.total,
            size: 'small',
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (total, range) => (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {range[0]}-{range[1]} of {total} items
              </Typography.Text>
            ),
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {createPortal(
        <UpdateMemberDrawer selectedMemberId={selectedMemberId} onMemberUpdate={handleMemberUpdate} />,
        document.body
      )}
    </div>
  );
};

export default TeamMembersSettings;


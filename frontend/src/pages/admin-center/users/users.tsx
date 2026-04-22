import { SearchOutlined, SyncOutlined } from '@/shared/antd-imports';
import { Button, Card, Divider, Flex, Input, Table, TableProps, Tooltip, Typography } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IOrganizationUser } from '@/types/admin-center/admin-center.types';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_admin_center_users_visit } from '@/shared/worklenz-analytics-events';
import { themeWiseColor } from '@/utils/themeWiseColor';

const Users: React.FC = () => {
  const { t } = useTranslation('admin-center/users');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<IOrganizationUser[]>([]);
  const [requestParams, setRequestParams] = useState({
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: 'name',
    order: 'desc',
    searchTerm: '',
  });

  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await adminCenterApiService.getOrganizationUsers(requestParams);
      if (res.done) {
        setUsers(res.body.data ?? []);
        setRequestParams(prev => ({ ...prev, total: res.body.total ?? 0 }));
      }
    } catch (error) {
      logger.error('Error fetching users', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: TableProps<IOrganizationUser>['columns'] = [
    {
      title: t('user'),
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Flex gap={12} align="center">
          <SingleAvatar avatarUrl={record.avatar_url} name={record.name} size={32} />
          <Typography.Text style={{ color: themeWiseColor('#262626', '#fafafa', themeMode), fontSize: '14px', fontWeight: 500 }}>{record.name}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: t('email'),
      dataIndex: 'email',
      key: 'email',
      render: text => (
        <Typography.Text 
            copyable={{ text }} 
            style={{ color: themeWiseColor('#8c8c8c', '#bfbfbf', themeMode), fontSize: '14px' }}
        >
            {text}
        </Typography.Text>
      ),
    },
    {
      title: t('lastActivity'),
      dataIndex: 'last_logged',
      key: 'last_logged',
      render: text => (
        <Typography.Text style={{ color: themeWiseColor('#8c8c8c', '#bfbfbf', themeMode), fontSize: '14px' }}>
            {formatDateTimeWithLocale(text) || '-'}
        </Typography.Text>
      ),
    },
  ];

  useEffect(() => {
    trackMixpanelEvent(evt_admin_center_users_visit);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    fetchUsers();
  }, [requestParams.searchTerm, requestParams.page, requestParams.pageSize]);

  const cardStyle: React.CSSProperties = {
    borderRadius: '8px',
    backgroundColor: themeWiseColor('#ffffff', '#1e1e1e', themeMode),
    border: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
    width: '100%',
    padding: '0',
    boxShadow: themeWiseColor('0 2px 8px rgba(0,0,0,0.05)', 'none', themeMode)
  };

  const countLabelStyle = {
    fontSize: '20px',
    color: themeWiseColor('#262626', '#ffffff', themeMode),
    fontWeight: 500
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '24px 0', backgroundColor: themeWiseColor('#ffffff', '#121417', themeMode) }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: '24px' }}>
        <div style={countLabelStyle}>
            {requestParams.total} {t('subTitle')}
        </div>
        
        <Flex gap={12} align="center">
          <Tooltip title={t('refresh')}>
            <Button
              shape="circle"
              icon={<SyncOutlined spin={isLoading} style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />}
              onClick={() => fetchUsers()}
              style={{ 
                backgroundColor: themeWiseColor('transparent', 'rgba(255,255,255,0.05)', themeMode), 
                border: `1px solid ${themeWiseColor('#d9d9d9', '#303030', themeMode)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </Tooltip>
          <Input
            placeholder={t('placeholder')}
            prefix={<SearchOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />}
            style={{ 
              width: 300, 
              backgroundColor: themeWiseColor('#ffffff', 'rgba(255,255,255,0.05)', themeMode), 
              borderColor: themeWiseColor('#d9d9d9', '#303030', themeMode),
              color: themeWiseColor('#262626', '#ffffff', themeMode),
              borderRadius: '8px',
              height: '38px'
            }}
            value={requestParams.searchTerm}
            onChange={e => setRequestParams(prev => ({ ...prev, searchTerm: e.target.value }))}
          />
        </Flex>
      </Flex>

      <Card style={cardStyle} bodyStyle={{ padding: '0' }}>
        <Table
          rowClassName="users-table-row"
          size="large"
          columns={columns}
          dataSource={users}
          pagination={{
            defaultPageSize: DEFAULT_PAGE_SIZE,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            size: 'small',
            showSizeChanger: true,
            total: requestParams.total,
            position: ['bottomRight'],
            style: { padding: '16px 24px' },
            onChange: (page, pageSize) => setRequestParams(prev => ({ ...prev, page, pageSize })),
          }}
          loading={isLoading}
          style={{ 
            backgroundColor: 'transparent'
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
      
      <style>{`
        .users-table-row:hover td {
          background-color: ${themeWiseColor('rgba(0, 0, 0, 0.02)', 'rgba(255, 255, 255, 0.02)', themeMode)} !important;
        }
        .ant-table {
          background: transparent !important;
          color: ${themeWiseColor('#262626', '#ffffff', themeMode)} !important;
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
          color: ${themeWiseColor('#595959', '#d1d1d1', themeMode)} !important;
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
    </div>
  );
};

export default Users;

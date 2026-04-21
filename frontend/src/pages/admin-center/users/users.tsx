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
          <Typography.Text style={{ color: '#fafafa', fontSize: '14px', fontWeight: 500 }}>{record.name}</Typography.Text>
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
            style={{ color: '#bfbfbf', fontSize: '14px' }}
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
        <Typography.Text style={{ color: '#bfbfbf', fontSize: '14px' }}>
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
    backgroundColor: '#141414',
    border: '1px solid #303030',
    width: '100%',
    padding: '0'
  };

  const countLabelStyle = {
    fontSize: '20px',
    color: '#ffffff',
    fontWeight: 500
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '24px 32px', backgroundColor: '#000000' }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: '24px' }}>
        <div style={countLabelStyle}>
            {requestParams.total} {t('subTitle')}
        </div>
        
        <Flex gap={12} align="center">
          <Tooltip title={t('refresh')}>
            <Button
              shape="circle"
              icon={<SyncOutlined spin={isLoading} style={{ color: '#8c8c8c' }} />}
              onClick={() => fetchUsers()}
              style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                border: '1px solid #303030',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </Tooltip>
          <Input
            placeholder={t('placeholder')}
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            style={{ 
              width: 300, 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              borderColor: '#303030',
              color: '#ffffff',
              borderRadius: '6px',
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
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
        .ant-table {
          background: transparent !important;
          color: #ffffff !important;
        }
        .ant-table-thead > tr > th {
          background: transparent !important;
          color: #bfbfbf !important;
          border-bottom: 1px solid #303030 !important;
          font-weight: 500 !important;
          padding: 16px 24px !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #303030 !important;
          padding: 16px 24px !important;
        }
        .ant-table-tbody > tr:last-child > td {
          border-bottom: none !important;
        }
        .ant-pagination-item, .ant-pagination-prev, .ant-pagination-next, .ant-pagination-item-link {
            background: transparent !important;
            border-color: #303030 !important;
        }
        .ant-pagination-item a {
            color: #8c8c8c !important;
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

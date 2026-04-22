import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';
import { RootState } from '@/app/store';
import { IOrganizationProject } from '@/types/admin-center/admin-center.types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import logger from '@/utils/errorLogger';
import './projects.css';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_admin_center_projects_visit } from '@/shared/worklenz-analytics-events';
import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { DeleteOutlined, SearchOutlined, SyncOutlined } from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { themeWiseColor } from '@/utils/themeWiseColor';

const Projects: React.FC = () => {
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const [isLoading, setIsLoading] = useState(false);
  const isTablet = useMediaQuery({ query: '(min-width: 1000px)' });
  const [projects, setProjects] = useState<IOrganizationProject[]>([]);
  const [requestParams, setRequestParams] = useState({
    total: 0,
    index: 1,
    size: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    search: '',
  });
  const { trackMixpanelEvent } = useMixpanelTracking();

  const dispatch = useAppDispatch();

  const { t } = useTranslation('admin-center/projects');

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await adminCenterApiService.getOrganizationProjects(requestParams);
      if (res.done) {
        setRequestParams(prev => ({ ...prev, total: res.body.total ?? 0 }));
        setProjects(res.body.data ?? []);
      }
    } catch (error) {
      logger.error('Error fetching projects', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!id) return;
    try {
      await projectsApiService.deleteProject(id);
      fetchProjects();
    } catch (error) {
      logger.error('Error deleting project', error);
    }
  };

  useEffect(() => {
    trackMixpanelEvent(evt_admin_center_projects_visit);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    fetchProjects();
  }, [
    requestParams.search,
    requestParams.index,
    requestParams.size,
    requestParams.field,
    requestParams.order,
  ]);

  const columns: TableProps<IOrganizationProject>['columns'] = [
    {
      title: 'Project name',
      key: 'projectName',
      render: (record: IOrganizationProject) => (
        <Typography.Text
          className="project-names"
          style={{ fontSize: `${isTablet ? '14px' : '12px'}`, color: themeWiseColor('#262626', '#fafafa', themeMode), fontWeight: 500 }}
        >
          {record.name}
        </Typography.Text>
      ),
    },
    {
      title: 'Team',
      key: 'team',
      render: (record: IOrganizationProject) => (
        <Typography.Text
          className="project-team"
          style={{ fontSize: `${isTablet ? '14px' : '12px'}`, color: themeWiseColor('#595959', '#bfbfbf', themeMode) }}
        >
          {record.team_name}
        </Typography.Text>
      ),
    },
    {
      title: <span style={{ display: 'flex', justifyContent: 'center' }}>{t('membersCount')}</span>,
      key: 'membersCount',
      render: (record: IOrganizationProject) => (
        <Typography.Text
          className="project-member-count"
          style={{
            display: 'flex',
            justifyContent: 'center',
            fontSize: `${isTablet ? '14px' : '12px'}`,
            color: themeWiseColor('#595959', '#bfbfbf', themeMode)
          }}
        >
          {record.member_count ?? 0}
        </Typography.Text>
      ),
    },
    {
      title: <span style={{ display: 'flex', justifyContent: 'right' }}>Created at</span>,
      key: 'createdAt',
      render: (record: IOrganizationProject) => (
        <Typography.Text
          className="project-created-at"
          style={{
            display: 'flex',
            justifyContent: 'right',
            fontSize: `${isTablet ? '14px' : '12px'}`,
            color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode)
          }}
        >
          {formatDateTimeWithLocale(record.created_at ?? '')}
        </Typography.Text>
      ),
    },
    {
      title: '',
      key: 'button',
      render: (record: IOrganizationProject) => (
        <div className="row-buttons" style={{ display: 'flex', justifyContent: 'right' }}>
          <Tooltip title={t('delete')}>
            <Popconfirm
              title={t('confirm')}
              description={t('deleteProject')}
              onConfirm={() => handleDeleteProject(record.id ?? '')}
            >
              <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />} />
            </Popconfirm>
          </Tooltip>
        </div>
      ),
    },
  ];

  const cardStyle: React.CSSProperties = {
    borderRadius: '8px',
    backgroundColor: themeWiseColor('#ffffff', '#1e1e1e', themeMode),
    border: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
    width: '100%',
    padding: '0',
    boxShadow: themeWiseColor('0 2px 8px rgba(0,0,0,0.05)', 'none', themeMode)
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '16px 0', backgroundColor: themeWiseColor('#ffffff', '#121417', themeMode) }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: '24px' }}>
        <Typography.Title level={4} style={{ margin: 0, fontSize: '20px', color: themeWiseColor('#262626', '#fff', themeMode) }}>
            {projects.length} projects
        </Typography.Title>
        
        <Flex gap={12} align="center">
          <Input
            placeholder={t('searchPlaceholder')}
            prefix={<SearchOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />}
            style={{ 
              width: 300, 
              backgroundColor: themeWiseColor('#ffffff', 'rgba(255,255,255,0.05)', themeMode), 
              borderColor: themeWiseColor('#d9d9d9', '#303030', themeMode),
              color: themeWiseColor('#262626', '#ffffff', themeMode),
              borderRadius: '8px',
              height: '38px'
            }}
            value={requestParams.search}
            onChange={e => setRequestParams(prev => ({ ...prev, search: e.target.value }))}
          />
          <Tooltip title={t('refreshProjects')}>
            <Button
              shape="circle"
              icon={<SyncOutlined spin={isLoading} style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />}
              onClick={() => fetchProjects()}
              style={{ 
                backgroundColor: themeWiseColor('transparent', 'rgba(255,255,255,0.05)', themeMode), 
                border: `1px solid ${themeWiseColor('#d9d9d9', '#303030', themeMode)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </Tooltip>
        </Flex>
      </Flex>

      <Card style={cardStyle} bodyStyle={{ padding: '0' }}>
        <Table<IOrganizationProject>
          rowClassName="project-table-row"
          columns={columns}
          dataSource={projects}
          rowKey={record => record.id ?? ''}
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 20,
            pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
            size: 'small',
            total: requestParams.total,
            current: requestParams.index,
            pageSize: requestParams.size,
            style: { padding: '16px 24px' },
            onChange: (page, pageSize) =>
              setRequestParams(prev => ({ ...prev, index: page, size: pageSize })),
          }}
          style={{ backgroundColor: 'transparent' }}
        />
      </Card>

      <style>{`
        .project-table-row:hover td {
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
      `}</style>
    </div>
  );
};

export default Projects;

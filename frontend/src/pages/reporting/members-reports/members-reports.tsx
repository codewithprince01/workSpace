import { Button, Card, Checkbox, Dropdown, Flex, Space, Typography } from '@/shared/antd-imports';
import { DownOutlined, FileExcelOutlined, SearchOutlined } from '@/shared/antd-imports';
import MembersReportsTable from './members-reports-table/members-reports-table';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import CustomSearchbar from '@components/CustomSearchbar';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import CustomPageHeader from '../page-header/custom-page-header';
import {
  fetchMembersData,
  setArchived,
  setDuration,
  setDateRange,
  setSearchQuery,
} from '@/features/reporting/membersReports/membersReportsSlice';
import { useAuthService } from '@/hooks/useAuth';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import { useEffect } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_allocation } from '@/shared/worklenz-analytics-events';

const MembersReports = () => {
  const { t } = useTranslation('reporting-members');
  const dispatch = useAppDispatch();
  useDocumentTitle('Reporting - Members');
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { archived, searchQuery, total } = useAppSelector(state => state.membersReportsReducer);
  const { duration, dateRange, mode: themeMode } = useAppSelector(state => state.reportingReducer);

  const handleExport = async () => {
    try {
      await reportingExportApiService.exportMembers(
        currentSession?.team_name || '',
        duration,
        dateRange,
        archived
      );
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_allocation);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    dispatch(setDuration(duration));
    dispatch(setDateRange(dateRange));
  }, [dateRange, duration]);

  const exportMenuItems = [
    {
      key: 'excel',
      label: 'Download Excel',
      icon: <FileExcelOutlined style={{ color: '#52c41a' }} />,
      onClick: handleExport,
    },
  ];

  return (
    <Flex vertical>
      <CustomPageHeader
        title={`Members (${total})`}
        children={
          <Space size={12}>
            <Button
              className={`transition-all duration-300 ${archived ? 'border-[#1890ff] text-[#1890ff]' : ''}`}
              onClick={() => dispatch(setArchived(!archived))}
              style={{ padding: '4px 12px' }}
            >
              <Flex align="center" gap={8}>
                <Checkbox checked={archived} style={{ pointerEvents: 'none' }} />
                <Typography.Text style={{ color: archived ? '#1890ff' : 'inherit' }}>
                  {t('includeArchivedButton')}
                </Typography.Text>
              </Flex>
            </Button>

            <TimeWiseFilter />

            <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
              <Button type="primary" icon={<DownOutlined />} iconPosition="end">
                {t('exportButton')}
              </Button>
            </Dropdown>
          </Space>
        }
      />

      <Card
        styles={{
          body: { padding: '16px 0' },
          header: { borderBottom: 'none' }
        }}
        title={
          <Flex justify="flex-end" style={{ padding: '0 16px' }}>
            <CustomSearchbar
              placeholderText={t('searchByNameInputPlaceholder')}
              searchQuery={searchQuery}
              setSearchQuery={query => dispatch(setSearchQuery(query))}
              prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            />
          </Flex>
        }
      >
        <MembersReportsTable />
      </Card>
    </Flex>
  );
};

export default MembersReports;

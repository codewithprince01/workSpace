import React, { memo } from 'react';
import { Card, Flex, Empty } from '@/shared/antd-imports';
import TimeReportingRightHeader from './timeReportingRightHeader/TimeReportingRightHeader';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';

const TimeLogsReports = () => {
  const { t } = useTranslation('reporting-sidebar');
  useDocumentTitle('Reporting - Time Logs');

  return (
    <Flex vertical>
      <TimeReportingRightHeader
        title={t('timeLogs')}
        exportType={[{ key: 'excel', label: 'Excel' }]}
        export={() => {}}
      />

      <Card style={{ marginTop: '1rem' }}>
        <Empty 
          description="Detailed Time Logs are coming soon." 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      </Card>
    </Flex>
  );
};

export default memo(TimeLogsReports);

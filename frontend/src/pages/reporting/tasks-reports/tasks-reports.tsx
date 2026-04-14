import React, { memo } from 'react';
import { Card, Flex, Empty } from '@/shared/antd-imports';
import CustomPageHeader from '@/pages/reporting/page-header/custom-page-header';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';

const TasksReports = () => {
  const { t } = useTranslation('reporting-sidebar'); // Using sidebar translations for title
  useDocumentTitle('Reporting - Tasks');

  return (
    <Flex vertical>
      <CustomPageHeader title={t('tasks')} />

      <Card style={{ marginTop: '1rem' }}>
        <Empty 
          description="Tasks reporting dashboard is coming soon." 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      </Card>
    </Flex>
  );
};

export default memo(TasksReports);

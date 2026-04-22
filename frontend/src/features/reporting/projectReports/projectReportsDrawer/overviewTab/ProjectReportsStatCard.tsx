import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
} from '@/shared/antd-imports';
import { Card, Flex, Typography } from '@/shared/antd-imports';
import React, { ReactNode } from 'react';
import { colors } from '../../../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewProjectTasksStats } from '@/types/reporting/reporting.types';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';

const ProjectReportsStatCard = ({
  values,
  loading,
}: {
  values: IRPTOverviewProjectTasksStats;
  loading: boolean;
}) => {
  // localization
  const { t } = useTranslation('reporting-projects-drawer');

  // stat items array
  const statItems = [
    {
      name: 'completedTasks',
      icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#75c997' }} />,
      value: values.completed || 0,
    },
    {
      name: 'incompleteTasks',
      icon: <FileExcelOutlined style={{ fontSize: 24, color: '#f6ce69' }} />,
      value: values.incompleted || 0,
    },
    {
      name: 'overdueTasks',
      icon: <ExclamationCircleOutlined style={{ fontSize: 24, color: '#eb6363' }} />,
      value: values.overdue || 0,
    },
    {
      name: 'allocatedHours',
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: colors.skyBlue }} />,
      value: values.total_allocated || 0,
    },
    {
      name: 'loggedHours',
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#75c997' }} />,
      value: values.total_logged || 0,
    },
  ];

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  return (
    <Card style={{ width: '100%' }} loading={loading}>
      <Flex vertical gap={16} style={{ padding: '12px 24px' }}>
        {statItems.map(item => (
          <Flex gap={12} align="center" key={item.name}>
            {item.icon}
            <Typography.Text style={{ fontSize: '16px', color: themeWiseColor('#262626', '#fff', themeMode) }}>
              {item.value} {t(`${item.name}Text`)}
            </Typography.Text>
          </Flex>
        ))}
      </Flex>
    </Card>
  );
};

export default ProjectReportsStatCard;

import { ConfigProvider, Select, Typography } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getStatusIcon } from '@/utils/projectUtils';
import { useEffect, useState } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setProjectStatus } from '@/features/reporting/projectReports/project-reports-slice';
import logger from '@/utils/errorLogger';

interface ProjectStatusCellProps {
  currentStatus: string;
  projectId: string;
}

const ProjectStatusCell = ({ currentStatus, projectId }: ProjectStatusCellProps) => {
  const { t } = useTranslation('reporting-projects');
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  
  // Use centralized project reporting statuses
  const { allStatuses } = useAppSelector(state => state.projectReportsReducer);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const statusOptions = allStatuses.map(status => ({
    value: status.id,
    label: (
      <Typography.Text
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {getStatusIcon(status.id || '', status.color_code || '')}
        {status.name}
      </Typography.Text>
    ),
  }));

  const handleStatusChange = (value: string) => {
    try {
      if (!value || !projectId) {
        throw new Error('Invalid status value or project ID');
      }

      const newStatus = allStatuses.find(status => status.id === value);
      if (!newStatus) {
        throw new Error('Status not found');
      }

      // Update local state immediately
      setSelectedStatus(value);

      // Update Redux store
      dispatch(setProjectStatus({ id: projectId, ...newStatus }));

      // Emit socket event
      socket?.emit(
        SocketEvents.PROJECT_STATUS_CHANGE.toString(),
        JSON.stringify({
          project_id: projectId,
          status_id: value,
        })
      );
    } catch (error) {
      logger.error('Error changing project status:', error);
    }
  };

  // Keep local state in sync with props
  useEffect(() => {
    setSelectedStatus(currentStatus);
  }, [currentStatus]);

  return (
    <ConfigProvider
      theme={{
        components: {
          Select: {
            selectorBg: colors.transparent,
            colorText: '#fff',
            colorIcon: 'rgba(255, 255, 255, 0.45)',
          },
        },
      }}
    >
      <Select
        variant="borderless"
        options={statusOptions}
        value={selectedStatus}
        onChange={handleStatusChange}
        style={{ width: '100%', color: '#fff' }}
        dropdownStyle={{ backgroundColor: '#262626' }}
      />
    </ConfigProvider>
  );
};

export default ProjectStatusCell;

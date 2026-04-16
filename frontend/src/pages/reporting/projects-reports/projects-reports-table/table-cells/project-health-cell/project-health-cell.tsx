import { Badge, Card, Dropdown, Flex, Menu, MenuProps, Typography } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { DownOutlined } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import './project-health-cell.css';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectHealth } from '@/types/project/projectHealth.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { setProjectHealth } from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';

interface HealthStatusDataType {
  value: string;
  label: string;
  color: string;
  projectId: string;
}

const ProjectHealthCell = ({ value, label, color, projectId }: HealthStatusDataType) => {
  const { t } = useTranslation('reporting-projects');
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  
  // Use centralized project reporting healths
  const { allHealths } = useAppSelector(state => state.projectReportsReducer);

  const projectHealth = allHealths.find(status => status.id === value) || {
    color_code: color,
    id: value,
    name: label,
  };

  const healthOptions = allHealths.map(status => ({
    key: status.id,
    value: status.id,
    label: (
      <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Badge color={status.color_code} /> {status.name}
      </Typography.Text>
    ),
  }));

  const handleHealthChangeResponse = (data: IProjectHealth) => {
    dispatch(setProjectHealth(data));
  };

  const onClick: MenuProps['onClick'] = e => {
    if (!e.key || !projectId) return;

    socket?.emit(
      SocketEvents.PROJECT_HEALTH_CHANGE.toString(),
      JSON.stringify({
        project_id: projectId,
        health_id: e.key,
      })
    );
  };

  // dropdown items
  const projectHealthCellItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="project-health-dropdown-card" bordered={false} style={{ backgroundColor: '#262626', border: 'none' }}>
          <Menu 
            theme="dark"
            className="project-health-menu" 
            items={healthOptions} 
            onClick={onClick} 
            style={{ backgroundColor: 'transparent', border: 'none' }}
          />
        </Card>
      ),
    },
  ];

  useEffect(() => {
    if (socket && connected) {
      socket.on(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), handleHealthChangeResponse);

      return () => {
        socket.removeListener(
          SocketEvents.PROJECT_HEALTH_CHANGE.toString(),
          handleHealthChangeResponse
        );
      };
    }
  }, [socket, connected]);

  const textColor = colors.darkGray; // Keeping original for health badges as they are usually colored backgrounds

  return (
    <Dropdown
      overlayClassName="project-health-dropdown"
      menu={{ items: projectHealthCellItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Flex
        gap={6}
        align="center"
        style={{
          width: 'fit-content',
          borderRadius: 24,
          paddingInline: 12,
          height: 28,
          backgroundColor: projectHealth?.color_code || 'transparent',
          color: textColor,
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <Typography.Text
          style={{
            textTransform: 'capitalize',
            color: textColor,
            fontSize: 12,
            fontWeight: 600
          }}
        >
          {projectHealth?.name}
        </Typography.Text>

        <DownOutlined style={{ fontSize: 10 }} />
      </Flex>
    </Dropdown>
  );
};

export default ProjectHealthCell;

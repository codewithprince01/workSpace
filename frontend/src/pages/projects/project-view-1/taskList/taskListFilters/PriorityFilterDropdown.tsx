import { CaretDownFilled } from '@/shared/antd-imports';
import { Badge, Button, Card, Checkbox, Dropdown, List, Space } from '@/shared/antd-imports';
import { useCallback } from 'react';

import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setPriorities } from '@/features/tasks/tasks.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';

const PriorityFilterDropdown = (props: { priorities: ITaskPriority[] }) => {
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();
  const { projectId } = useAppSelector(state => state.projectReducer);
  const selectedPriorities = useAppSelector(state => state.taskReducer.priorities);

  // localization
  const { t } = useTranslation('task-list-filters');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const selectedCount = selectedPriorities.length;

  const handleSelectedPriority = useCallback(
    (priorityId: string) => {
      if (!projectId) return;

      const newPriorities = selectedPriorities.includes(priorityId)
        ? selectedPriorities.filter(id => id !== priorityId)
        : [...selectedPriorities, priorityId];
      
      dispatch(setPriorities(newPriorities));
      
      // Trigger fetch for the new list table
      dispatch(fetchTasksV3(projectId));
    },
    [dispatch, projectId, selectedPriorities]
  );

  // custom dropdown content
  const priorityDropdownContent = (
    <Card className="custom-card" style={{ width: 120 }} styles={{ body: { padding: 0 } }}>
      <List style={{ padding: 0, maxHeight: 250, overflow: 'auto' }}>
        {props.priorities?.map(item => (
          <List.Item
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            key={item.id}
            onClick={() => handleSelectedPriority(item.id)}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Space onClick={(e) => e.stopPropagation()}>
              <Checkbox 
                id={item.id} 
                checked={selectedPriorities.includes(item.id)}
                onChange={() => handleSelectedPriority(item.id)} 
              />
              <Badge color={item.color_code} />
              {item.name}
            </Space>
          </List.Item>
        ))}
      </List>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => priorityDropdownContent}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        style={{
          backgroundColor: selectedCount > 0 ? (themeMode === 'dark' ? '#003a5c' : colors.paleBlue) : colors.transparent,
          color: selectedCount > 0 ? (themeMode === 'dark' ? 'white' : colors.darkGray) : 'inherit',
        }}
      >
        <Space>
          {t('priorityText')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default PriorityFilterDropdown;


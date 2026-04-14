import { MoreOutlined } from '@/shared/antd-imports';
import { Button, Card, Checkbox, Dropdown, List, Space } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  projectViewTaskListColumnsState,
  toggleColumnVisibility,
} from '@features/projects/singleProject/taskListColumns/taskColumnsSlice';
import { columnList } from '../taskListTable/columns/columnList';
import { useTranslation } from 'react-i18next';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import { updateColumnVisibility } from '@features/tasks/tasks.slice';

const ShowFieldsFilterDropdown = () => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const customColumns = useAppSelector(state => state.taskReducer.customColumns);

  const changableColumnList = [
    ...columnList.filter(column => !['selector', 'task'].includes(column.key)),
    ...(customColumns || []).map(col => ({
      key: col.key,
      columnHeader: col.custom_column_obj.columnHeader,
      isCustomColumn: col.custom_column,
    })),
  ];

  const columnsVisibility = useAppSelector(
    state => state.taskReducer.columns.reduce((acc, col) => {
      if (col.key) acc[col.key] = !!col.pinned;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const { projectId } = useSelectedProject();

  const handleColumnToggle = (columnKey: string, isCustomColumn: boolean = false) => {
    const isCurrentlyVisible = !!columnsVisibility[columnKey as keyof typeof columnsVisibility];
    
    // Create the updated item based on ITaskListColumn type
    const item = {
      key: columnKey,
      pinned: !isCurrentlyVisible, // Use 'pinned' for the API consistency
      custom_column: isCustomColumn
    };

    // Use the async thunk to persist to backend
    dispatch(updateColumnVisibility({ projectId, item }));
    
    trackMixpanelEvent('task_list_column_visibility_changed', {
      column: columnKey,
      isCustomColumn,
      visible: !isCurrentlyVisible,
    });
  };

  const showFieldsDropdownContent = (
    <Card
      className="custom-card"
      style={{
        height: 300,
        overflowY: 'auto',
        minWidth: 130,
      }}
      styles={{ body: { padding: 0 } }}
    >
      <List style={{ padding: 0 }}>
        {changableColumnList.map(col => (
          <List.Item
            key={col.key}
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => handleColumnToggle(col.key, col.custom_column)}
          >
            <Space>
              <Checkbox
                checked={
                  columnsVisibility[
                    col.key as keyof projectViewTaskListColumnsState['columnsVisibility']
                  ]
                }
              />
              {col.custom_column
                ? col.columnHeader
                : t(col.key === 'phases' ? 'phasesText' : `${col.columnHeader}Text`)}
            </Space>
          </List.Item>
        ))}
      </List>
    </Card>
  );

  return (
    <Dropdown overlay={showFieldsDropdownContent} trigger={['click']} placement="bottomRight">
      <Button icon={<MoreOutlined />}>{t('showFieldsText')}</Button>
    </Dropdown>
  );
};

export default ShowFieldsFilterDropdown;

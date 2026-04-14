/* eslint-disable react-hooks/exhaustive-deps */
import { PlusOutlined } from '@/shared/antd-imports';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Dropdown,
  Flex,
  Input,
  InputRef,
  List,
  Typography,
} from '@/shared/antd-imports';
import React, { useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { ITaskLabel } from '@/types/label.type';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { SocketEvents } from '@/shared/socket-events';
import { isLabelSelected, getNormalizedLabelId } from '@/utils/labelUtils';
import { updateTaskLabel } from '@features/tasks/tasks.slice';

interface LabelsSelectorProps {
  taskId: string | null;
  labels: ITaskLabel[];
}

const LabelsSelector = ({ taskId, labels }: LabelsSelectorProps) => {
  const labelInputRef = useRef<InputRef>(null);
  // this is for get the current string that type on search bar
  const [searchQuery, setSearchQuery] = useState<string>('');

  // localization
  const { t } = useTranslation('task-list-table');

  const dispatch = useAppDispatch();

  // get task list from redux and find the selected task
  const selectedTask = useAppSelector(state => state.taskReducer.tasks).find(
    task => task.id === taskId
  );

  // used useMemo hook for re-render the list when searching
  const filteredLabelData = useMemo(() => {
    return labels.filter(label => label.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [labels, searchQuery]);

  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();

  const handleLabelChange = (label: ITaskLabel) => {
    if (!selectedTask) return;
    try {
      const labelId = getNormalizedLabelId(label);
      if (!labelId) return;

      const nextSelectedState = !isLabelSelected(labelId, selectedTask.labels as any);
      const labelData = {
        task_id: selectedTask.id,
        label_id: labelId,
        is_selected: nextSelectedState,
        parent_task: selectedTask.parent_task_id,
        team_id: currentSession?.team_id,
      };
      
      const eventName = SocketEvents.TASK_LABELS_CHANGE.toString();
      socket?.emit(eventName, JSON.stringify(labelData));
      // Dispatch optimistic update if needed, but socket typically handles it
    } catch (error) {
      console.error('Error changing label:', error);
    }
  };

  const handleCreateLabel = (name: string) => {
    if (name.length > 0 && selectedTask) {
      const labelData = {
        task_id: selectedTask.id,
        label: name.trim(),
        parent_task: selectedTask.parent_task_id,
        team_id: currentSession?.team_id,
      };
      const eventName = SocketEvents.CREATE_LABEL.toString();
      socket?.emit(eventName, JSON.stringify(labelData));
      setSearchQuery('');
    }
  };

  // custom dropdown content
  const labelDropdownContent = (
    <Card
      className="custom-card"
      styles={{ body: { padding: 8, overflow: 'hidden', overflowY: 'auto', maxHeight: '255px' } }}
    >
      <Flex vertical gap={8}>
        <Input
          ref={labelInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchInputPlaceholder')}
          onKeyDown={e => {
            const isLabel = filteredLabelData.findIndex(
              label => label.name?.toLowerCase() === searchQuery.toLowerCase()
            );

            if (isLabel === -1) {
              if (e.key === 'Enter') {
                handleCreateLabel(searchQuery);
              }
            }
          }}
        />

        <List style={{ padding: 0, maxHeight: 250, overflowY: 'auto' }}>
          {searchQuery.trim() && !labels.some(l => l.name?.toLowerCase() === searchQuery.trim().toLowerCase()) && (
            <List.Item
              style={{
                display: 'flex',
                gap: 8,
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0'
              }}
              onClick={() => handleCreateLabel(searchQuery)}
            >
              <PlusOutlined style={{ color: colors.primary }} />
              <Typography.Text strong style={{ color: colors.primary }}>
                {t('labelSelectorCreatePrefix', { defaultValue: 'Create' })} "{searchQuery.trim()}"
              </Typography.Text>
            </List.Item>
          )}

          {filteredLabelData.length ? (
            filteredLabelData.map(label => {
              const labelId = getNormalizedLabelId(label);
              const selected = isLabelSelected(labelId, selectedTask?.labels);
              return (
                <List.Item
                  className="custom-list-item"
                  key={labelId}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    gap: 8,
                    padding: '4px 8px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleLabelChange(label)}
                >
                  <Checkbox
                    checked={selected}
                    onChange={() => {}} // Controlled
                  />

                  <Flex gap={8} style={{ marginLeft: 8 }}>
                    <Badge color={label.color_code} />
                    <Typography.Text>{label.name}</Typography.Text>
                  </Flex>
                </List.Item>
              );
            })
          ) : !searchQuery.trim() ? (
            <div style={{ padding: '16px', textAlign: 'center', color: colors.lightGray }}>
              {t('labelSelectorNoLabels', { defaultValue: 'No labels' })}
            </div>
          ) : null}
        </List>

        <Divider style={{ margin: 0 }} />

        <Button
          type="primary"
          style={{ alignSelf: 'flex-end' }}
          onClick={() => handleCreateLabel(searchQuery)}
        >
          {t('okButton')}
        </Button>
      </Flex>
    </Card>
  );

  // function to focus label input
  const handleLabelDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <Dropdown
      trigger={['click']}
      dropdownRender={() => labelDropdownContent}
      onOpenChange={handleLabelDropdownOpen}
    >
      <Button
        type="dashed"
        icon={<PlusOutlined style={{ fontSize: 11 }} />}
        style={{ height: 18 }}
        size="small"
      />
    </Dropdown>
  );
};

export default LabelsSelector;

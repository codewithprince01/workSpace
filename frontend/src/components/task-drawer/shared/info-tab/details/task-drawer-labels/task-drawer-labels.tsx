import { PlusOutlined } from '@/shared/antd-imports';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Form,
  Input,
  InputRef,
  List,
  Tag,
  Typography,
} from '@/shared/antd-imports';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { ITaskLabel } from '@/types/label.type';
import { useAuthService } from '@/hooks/useAuth';
import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { TFunction } from 'i18next';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setTaskLabels } from '@/features/task-drawer/task-drawer.slice';
import { updateTaskLabel } from '@/features/tasks/tasks.slice';
import { updateEnhancedKanbanTaskLabels } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { ILabelsChangeResponse } from '@/types/tasks/taskList.types';
import { sortLabelsBySelection, isLabelSelected, getNormalizedLabelId } from '@/utils/labelUtils';
import { message } from '@/shared/antd-imports';

interface TaskDrawerLabelsProps {
  task: ITaskViewModel;
  t: TFunction;
}

const TaskDrawerLabels = ({ task, t }: TaskDrawerLabelsProps) => {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const labelInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { labels } = useAppSelector(state => state.taskLabelsReducer);
  const [labelList, setLabelList] = useState<ITaskLabel[]>([]);

  const currentSession = useAuthService().getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { tab } = useTabSearchParam();

  const handleLabelChange = (label: ITaskLabel) => {
    try {
      const labelId = getNormalizedLabelId(label);
      if (!labelId) return;

      const nextSelectedState = !isLabelSelected(labelId, task?.labels as any);
      const labelData = {
        task_id: task.id,
        label_id: labelId,
        is_selected: nextSelectedState,
        parent_task: task.parent_task_id,
        team_id: currentSession?.team_id,
      };
      const eventName = SocketEvents.TASK_LABELS_CHANGE.toString();
      const handler = (data: ILabelsChangeResponse) => {
        if (!data || String((data as any).id || '') !== String(task?.id || '')) {
          return;
        }

        dispatch(setTaskLabels(data));
        if (tab === 'tasks-list') {
          dispatch(updateTaskLabel(data));
        }
        if (tab === 'board') {
          dispatch(updateEnhancedKanbanTaskLabels(data));
        }
        socket?.off(eventName, handler);
      };
      socket?.on(eventName, handler);
      socket?.emit(eventName, JSON.stringify(labelData));
    } catch (error) {
      console.error('Error changing label:', error);
      message.error('Failed to update labels');
    }
  };

  const handleCreateLabel = () => {
    if (!searchQuery.trim()) return;
    const labelData = {
      task_id: task.id,
      label: searchQuery.trim(),
      parent_task: task.parent_task_id,
      team_id: currentSession?.team_id,
    };
    const eventName = SocketEvents.CREATE_LABEL.toString();
    const handler = (data: ILabelsChangeResponse) => {
      if (!data || String((data as any).id || '') !== String(task?.id || '')) {
        return;
      }

      dispatch(setTaskLabels(data));
      if (tab === 'tasks-list') {
        dispatch(updateTaskLabel(data));
      }
      if (tab === 'board') {
        dispatch(updateEnhancedKanbanTaskLabels(data));
      }
      socket?.off(eventName, handler);
    };
    socket?.on(eventName, handler);
    socket?.emit(eventName, JSON.stringify(labelData));
  };

  useEffect(() => {
    setLabelList(labels as ITaskLabel[]);
  }, [labels, task?.labels]);

  const filteredLabelData = useMemo(() => {
    const filtered = labelList.filter(label =>
      label.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return sortLabelsBySelection(filtered, task?.labels || []);
  }, [labelList, searchQuery, task?.labels]);

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
          placeholder={t('taskInfoTab.labels.labelInputPlaceholder')}
          onKeyDown={e => {
            if (e.key === 'Enter' && searchQuery.trim()) {
              const exactMatch = labelList.find(
                label => label.name?.toLowerCase() === searchQuery.trim().toLowerCase()
              );
              if (!exactMatch) {
                handleCreateLabel();
                setSearchQuery('');
              }
            }
          }}
        />

        <List 
          style={{ padding: 0, maxHeight: 300, overflowY: 'auto' }}
          className="custom-label-list"
        >
          {searchQuery.trim() && !labelList.some(l => l.name?.toLowerCase() === searchQuery.trim().toLowerCase()) && (
            <List.Item
              className={themeMode === 'dark' ? 'custom-list-item dark create-option' : 'custom-list-item create-option'}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid ' + (themeMode === 'dark' ? '#303030' : '#f0f0f0')
              }}
              onClick={() => {
                handleCreateLabel();
                setSearchQuery('');
              }}
            >
              <Flex gap={8} align="center">
                <PlusOutlined style={{ color: colors.primary }} />
                <Typography.Text strong style={{ color: colors.primary }}>
                  {t('taskInfoTab.labels.createLabelPrefix', { defaultValue: 'Create' })} "{searchQuery.trim()}"
                </Typography.Text>
              </Flex>
            </List.Item>
          )}

          {filteredLabelData.length > 0 ? (
            filteredLabelData.map(label => {
              const labelId = getNormalizedLabelId(label);
              const selected = isLabelSelected(labelId, task?.labels);
              return (
                <List.Item
                  className={`${themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'} ${selected ? 'selected' : ''}`}
                  key={labelId}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    gap: 8,
                    padding: '8px 12px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleLabelChange(label)}
                >
                  <Checkbox
                    checked={selected}
                    onChange={() => {}} // Controlled by Item onClick
                  />
                  <Flex gap={8} align="center" style={{ marginLeft: 8 }}>
                    <Badge color={label.color_code} />
                    <Typography.Text>{label.name}</Typography.Text>
                  </Flex>
                </List.Item>
              );
            })
          ) : !searchQuery.trim() ? (
            <div style={{ padding: '16px', textAlign: 'center', color: colors.lightGray }}>
              {t('taskInfoTab.labels.noLabelsText', { defaultValue: 'No labels in this project' })}
            </div>
          ) : null}
        </List>
      </Flex>
    </Card>
  );

  const handleLabelDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <Form.Item name="labels" label={t('taskInfoTab.details.labels')}>
      <Flex gap={8} wrap="wrap" align="center">
        {task?.labels?.map((label) => (
          <Tag
            key={label.id}
            color={label.color_code + ALPHA_CHANNEL}
            closable
            onClose={(e) => {
              e.preventDefault();
              handleLabelChange(label);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyItems: 'center',
              height: 18,
              fontSize: 11,
              marginBottom: 4,
            }}
          >
            {label.name}
          </Tag>
        ))}
        <Dropdown
          trigger={['click']}
          dropdownRender={() => labelDropdownContent}
          onOpenChange={handleLabelDropdownOpen}
        >
          <Button
            type="dashed"
            icon={<PlusOutlined style={{ fontSize: 11 }} />}
            style={{ height: 18, marginBottom: 4 }}
            size="small"
          />
        </Dropdown>
      </Flex>
    </Form.Item>
  );
};

export default TaskDrawerLabels;

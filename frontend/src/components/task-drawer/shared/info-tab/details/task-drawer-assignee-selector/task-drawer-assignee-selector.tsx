import { InputRef } from 'antd/es/input';
import Card from 'antd/es/card';
import Checkbox from 'antd/es/checkbox';
import Dropdown from 'antd/es/dropdown';
import Empty from 'antd/es/empty';
import Flex from 'antd/es/flex';
import Input from 'antd/es/input';
import List from 'antd/es/list';
import Typography from 'antd/es/typography';
import Button from 'antd/es/button';
import { useMemo, useRef, useState } from 'react';
import { message } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { PlusOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { setTaskAssignee } from '@/features/task-drawer/task-drawer.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { updateTaskAssignees as updateBoardTaskAssignees } from '@/features/board/board-slice';
import { updateTaskAssignees as updateTasksListTaskAssignees } from '@/features/tasks/tasks.slice';
import { updateEnhancedKanbanTaskAssignees } from '@/features/enhanced-kanban/enhanced-kanban.slice';
interface TaskDrawerAssigneeSelectorProps {
  task: ITaskViewModel;
}

const TaskDrawerAssigneeSelector = ({ task }: TaskDrawerAssigneeSelectorProps) => {
  const membersInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const { projectId } = useAppSelector(state => state.projectReducer);
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { t } = useTranslation('task-list-table');
  const { tab } = useTabSearchParam();

  const dispatch = useAppDispatch();
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);

  const filteredMembersData = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  const isAssigneeSelected = (memberId: string) => {
    if (!memberId || !task) return false;
    const directMatch = task.assignees?.some(assignee => String(assignee) === String(memberId));
    if (directMatch) return true;

    const inlineMatch = (task.names || []).some(
      member => String((member as any)?.team_member_id || (member as any)?.id || '') === String(memberId)
    );
    if (inlineMatch) return true;

    const assigneeNamesMatch = (task.assignee_names || []).some(
      member => String((member as any)?.team_member_id || (member as any)?.id || '') === String(memberId)
    );
    return assigneeNamesMatch;
  };

  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      const membersData = (members?.data || []).map(member => ({
        ...member,
        selected: isAssigneeSelected(member.id || ''),
      }));
      let sortedMembers = sortTeamMembers(membersData);

      setTeamMembers({ data: sortedMembers });

      setTimeout(() => {
        membersInputRef.current?.focus();
      }, 0);
    } else {
      setTeamMembers(members || { data: [] });
    }
  };

  const handleMemberChange = (e: CheckboxChangeEvent | null, memberId: string) => {
    if (!memberId || !projectId || !task?.id || !currentSession?.id) return;
    try {
      const checked =
        e?.target.checked ?? !isAssigneeSelected(memberId);

      const body = {
        team_member_id: memberId,
        project_id: projectId,
        task_id: task.id,
        reporter_id: currentSession?.id,
        mode: checked ? 0 : 1,
        parent_task: task.parent_task_id,
      };

      const eventName = SocketEvents.QUICK_ASSIGNEES_UPDATE.toString();
      const handler = (data: ITaskAssigneesUpdateResponse) => {
        if (!data || String((data as any).id || '') !== String(task.id)) {
          return;
        }

        dispatch(setTaskAssignee(data));
        if (tab === 'tasks-list') {
          dispatch(updateTasksListTaskAssignees(data));
        }
        if (tab === 'board') {
          dispatch(updateEnhancedKanbanTaskAssignees(data));
        }
        socket?.off(eventName, handler);
      };

      socket?.on(eventName, handler);
      socket?.emit(eventName, JSON.stringify(body));
    } catch (error) {
      console.error('Error updating assignee:', error);
      message.error('Failed to update assignee');
    }
  };

  const checkMemberSelected = (memberId: string) => {
    return isAssigneeSelected(memberId);
  };

  const membersDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical>
        <Input
          ref={membersInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchInputPlaceholder')}
        />

        <List style={{ padding: 0, height: 250, overflow: 'auto' }}>
          {filteredMembersData?.length ? (
            filteredMembersData.map(member => (
              <List.Item
                className={`${themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'} ${member.pending_invitation ? 'disabled cursor-not-allowed' : ''}`}
                key={member.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-start',
                  padding: '4px 8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (member.pending_invitation) return;
                  handleMemberChange(null, member.id || '');
                }}
              >
                <Checkbox
                  id={member.id}
                  checked={checkMemberSelected(member.id || '')}
                  onChange={e => handleMemberChange(e, member.id || '')}
                  disabled={member.pending_invitation}
                />
                <div>
                  <SingleAvatar
                    avatarUrl={member.avatar_url}
                    name={member.name}
                    email={member.email}
                  />
                </div>
                <Flex vertical>
                  <Typography.Text>{member.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {member.email}&nbsp;
                    {member.pending_invitation && (
                      <Typography.Text type="danger" style={{ fontSize: 10 }}>
                        ({t('pendingInvitation')})
                      </Typography.Text>
                    )}
                  </Typography.Text>
                </Flex>
              </List.Item>
            ))
          ) : (
            <Empty />
          )}
        </List>
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => membersDropdownContent}
      onOpenChange={handleMembersDropdownOpen}
    >
      <Button
        type="dashed"
        shape="circle"
        size="small"
        icon={
          <PlusOutlined
            style={{
              fontSize: 12,
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        }
      />
    </Dropdown>
  );
};

export default TaskDrawerAssigneeSelector;

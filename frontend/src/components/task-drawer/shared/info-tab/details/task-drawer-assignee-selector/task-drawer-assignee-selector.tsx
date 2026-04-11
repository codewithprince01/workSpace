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
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { updateEnhancedKanbanTaskAssignees } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { updateTaskAssignees as updateTaskManagementAssignees } from '@/features/task-management/task-management.slice';
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
  const dispatch = useAppDispatch();
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const selectedTaskId = useAppSelector(state => state.taskDrawerReducer.selectedTaskId);
  const [optimisticSelectedIds, setOptimisticSelectedIds] = useState<string[]>([]);

  const normalizeId = (value: unknown) => String(value || '');
  const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
  const resolveMemberId = (member: any) =>
    normalizeId(member?.team_member_id || member?.id || member?._id);

  const getCandidateKeys = (value: any) => {
    if (!value) return [];
    if (typeof value === 'string') return [normalizeId(value)];
    return [
      normalizeId(value?.team_member_id),
      normalizeId(value?.id),
      normalizeId(value?._id),
      normalizeId(value?.user_id),
      normalizeEmail(value?.email),
    ].filter(Boolean);
  };

  const getMemberSelectionKeys = (member: any) =>
    [
      resolveMemberId(member),
      normalizeId(member?.team_member_id),
      normalizeId(member?.user_id),
      normalizeId(member?.id),
      normalizeEmail(member?.email),
    ].filter(Boolean);

  const getTaskSelectedIdPool = (taskValue: ITaskViewModel) => {
    const selectedIdPool = new Set<string>();
    (taskValue?.assignees || []).forEach(assignee => {
      getCandidateKeys(assignee).forEach(id => selectedIdPool.add(id));
    });
    (taskValue?.names || []).forEach(assignee => {
      getCandidateKeys(assignee).forEach(id => selectedIdPool.add(id));
    });
    (taskValue?.assignee_names || []).forEach(assignee => {
      getCandidateKeys(assignee).forEach(id => selectedIdPool.add(id));
    });
    return Array.from(selectedIdPool);
  };

  useEffect(() => {
    setOptimisticSelectedIds(getTaskSelectedIdPool(task));
    // Only reset when drawer task changes to avoid flicker during in-flight updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  useEffect(() => {
    const eventName = SocketEvents.QUICK_ASSIGNEES_UPDATE.toString();
    const handler = (data: ITaskAssigneesUpdateResponse) => {
      const effectiveTaskId = String(task?.id || selectedTaskId || '');
      if (!data || String((data as any).id || '') !== effectiveTaskId) return;

      dispatch(setTaskAssignee(data));
      dispatch(
        updateTaskManagementAssignees({
          taskId: String(data.id || effectiveTaskId),
          assigneeIds: (data.assignees || []).map(a =>
            String(a?.team_member_id || a?.id || '')
          ),
          assigneeNames: (data.names || data.assignees || []).map(a => ({
            team_member_id: String((a as any)?.team_member_id || (a as any)?.id || ''),
            id: String((a as any)?.id || (a as any)?.team_member_id || ''),
            name: (a as any)?.name || '',
            avatar_url: (a as any)?.avatar_url || '',
          })),
        })
      );
      dispatch(updateEnhancedKanbanTaskAssignees(data));
      setOptimisticSelectedIds(getTaskSelectedIdPool(data as any));
    };

    socket?.on(eventName, handler);
    return () => {
      socket?.off(eventName, handler);
    };
  }, [dispatch, selectedTaskId, socket, task?.id]);

  const filteredMembersData = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  const isAssigneeSelected = (member: any) => {
    if (!member || !task) return false;

    const memberIds = new Set(getMemberSelectionKeys(member));

    const selectedIdPool = new Set<string>(optimisticSelectedIds);

    return Array.from(memberIds).some(id => selectedIdPool.has(id));
  };

  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      const membersData = (members?.data || []).map(member => ({
        ...member,
        selected: isAssigneeSelected(member),
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

  const handleMemberChange = (e: CheckboxChangeEvent | null, member: any) => {
    const memberId = resolveMemberId(member);
    const effectiveTaskId = String(task?.id || selectedTaskId || '');
    if (!memberId || !projectId || !effectiveTaskId) return;
    try {
      const checked =
        e?.target.checked ??
        !isAssigneeSelected(member);

      const memberSelectionKeys = getMemberSelectionKeys(member);

      setOptimisticSelectedIds(prev => {
        if (checked) {
          const next = new Set(prev);
          memberSelectionKeys.forEach(key => next.add(key));
          return Array.from(next);
        }
        return prev.filter(id => !memberSelectionKeys.includes(id));
      });

      const body = {
        team_member_id: memberId,
        project_id: projectId,
        task_id: effectiveTaskId,
        reporter_id: currentSession?.id || undefined,
        mode: checked ? 0 : 1,
        parent_task: task.parent_task_id,
      };

      socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
    } catch (error) {
      console.error('Error updating assignee:', error);
      message.error('Failed to update assignee');
    }
  };

  const checkMemberSelected = (member: any) => {
    return isAssigneeSelected(member);
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
                key={resolveMemberId(member) || member.email || member.name}
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
                  handleMemberChange(null, member);
                }}
              >
                <Checkbox
                  id={resolveMemberId(member)}
                  checked={checkMemberSelected(member)}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    e.stopPropagation();
                    handleMemberChange(e, member);
                  }}
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

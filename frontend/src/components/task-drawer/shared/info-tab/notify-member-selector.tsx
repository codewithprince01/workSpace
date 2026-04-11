import { PlusOutlined } from '@/shared/antd-imports';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputRef,
  List,
  Typography,
} from '@/shared/antd-imports';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TFunction } from 'i18next';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTaskCounts } from '@/features/task-management/task-management.slice';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import logger from '@/utils/errorLogger';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import Avatars from '@/components/avatars/avatars';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { setTaskSubscribers } from '@/features/task-drawer/task-drawer.slice';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';

interface NotifyMemberSelectorProps {
  task: ITaskViewModel;
  t: TFunction;
}

const NotifyMemberSelector = ({ task, t }: NotifyMemberSelectorProps) => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();

  const membersInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [members, setMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [optimisticSubscriberIds, setOptimisticSubscriberIds] = useState<string[]>([]);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { subscribers, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const fetchTeamMembers = async () => {
    if (!projectId) return;

    try {
      setTeamMembersLoading(true);
      const response = await teamMembersApiService.getAll(projectId);
      if (response.done) {
        let sortedMembers = sortTeamMembers(response.body || []);

        setMembers({ data: sortedMembers });
      }
    } catch (error) {
      logger.error('Error fetching team members:', error);
    } finally {
      setTeamMembersLoading(false);
    }
  };

  const getSubscribers = async () => {
    const effectiveTaskId = String(task?.id || selectedTaskId || '');
    if (!effectiveTaskId) return;
    try {
      const response = await tasksApiService.getSubscribers(effectiveTaskId);
      if (response.done) {
        dispatch(setTaskSubscribers(response.body || []));
      }
    } catch (error) {
      logger.error('Error fetching subscribers:', error);
    }
  };

  // used useMemo hook for re render the list when searching
  const filteredMembersData = useMemo(() => {
    return members.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [members, searchQuery]);

  const normalizeId = (value: unknown) => String(value || '');
  const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
  const resolveMemberId = (member: any) =>
    normalizeId(member?.team_member_id || member?.id || member?._id);

  const getSubscriberIds = (subscriber: any) => {
    return [
      normalizeId(subscriber?.team_member_id),
      normalizeId(subscriber?.user_id),
      normalizeId(subscriber?.id),
      normalizeEmail(subscriber?.email),
    ].filter(Boolean);
  };

  const getMemberSelectionKeys = (member: any) => {
    return [
      resolveMemberId(member),
      normalizeId(member?.team_member_id),
      normalizeId(member?.user_id),
      normalizeId(member?.id),
      normalizeEmail(member?.email),
    ].filter(Boolean);
  };

  useEffect(() => {
    const selectedIds = new Set<string>();
    (subscribers || []).forEach(sub => {
      getSubscriberIds(sub).forEach(id => selectedIds.add(id));
    });
    setOptimisticSubscriberIds(Array.from(selectedIds));
  }, [subscribers, task?.id]);

  useEffect(() => {
    const eventName = SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString();
    const handler = (data: InlineMember[]) => {
      const selectedIds = new Set<string>();
      (data || []).forEach(subscriber => {
        getSubscriberIds(subscriber).forEach(id => selectedIds.add(id));
      });
      setOptimisticSubscriberIds(Array.from(selectedIds));
      dispatch(setTaskSubscribers(data));
      dispatch(
        updateTaskCounts({
          taskId: String(task?.id || selectedTaskId || ''),
          counts: { has_subscribers: !!(data && data.length) },
        })
      );
    };

    socket?.on(eventName, handler);
    return () => {
      socket?.off(eventName, handler);
    };
  }, [dispatch, selectedTaskId, socket, task?.id]);

  const isSubscriberSelected = (memberId?: string) => {
    if (!memberId) return false;
    const selectedIds = new Set<string>(optimisticSubscriberIds);

    const member = (members.data || []).find(m => resolveMemberId(m) === normalizeId(memberId));
    const memberIds = getMemberSelectionKeys(member);

    return memberIds.some(id => selectedIds.has(id));
  };

  const handleMemberClick = (member: ITeamMemberViewModel, checked: boolean) => {
    const effectiveTaskId = String(task?.id || selectedTaskId || '');
      const memberId = resolveMemberId(member);
    if (!effectiveTaskId || !connected || !memberId) return;
    try {
      const memberSelectionKeys = getMemberSelectionKeys(member);

      setOptimisticSubscriberIds(prev => {
        if (checked) {
          const next = new Set(prev);
          memberSelectionKeys.forEach(key => next.add(key));
          return Array.from(next);
        }
        return prev.filter(id => !memberSelectionKeys.includes(id));
      });

      const body = {
        team_member_id: memberId,
        task_id: effectiveTaskId,
        user_id: member.user_id || null,
        mode: checked ? 0 : 1,
      };
      socket?.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), body);
    } catch (error) {
      logger.error('Error notifying member:', error);
    }
  };

  // custom dropdown content
  const membersDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={membersInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('taskInfoTab.searchInputPlaceholder')}
        />
        <List
          style={{ padding: 0, maxHeight: 250, overflow: 'auto' }}
          loading={teamMembersLoading}
          size="small"
        >
          {filteredMembersData?.length ? (
            filteredMembersData.map(member => (
              <List.Item
                className={`${themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'} ${member.pending_invitation || member.is_pending ? 'disabled' : ''}`}
                key={resolveMemberId(member) || member.email || member.name}
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-start',
                  padding: '4px 8px',
                  border: 'none',
                  cursor:
                    member.pending_invitation || member.is_pending ? 'not-allowed' : 'pointer',
                  pointerEvents: member.pending_invitation || member.is_pending ? 'none' : 'auto',
                  opacity: member.pending_invitation || member.is_pending ? 0.6 : 1,
                }}
                onClick={e => {
                  if (member.pending_invitation || member.is_pending) return;
                  handleMemberClick(
                    member,
                    !isSubscriberSelected(resolveMemberId(member))
                  );
                }}
              >
                <Checkbox
                  id={resolveMemberId(member)}
                  checked={isSubscriberSelected(resolveMemberId(member))}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    e.stopPropagation();
                    handleMemberClick(member, e.target.checked);
                  }}
                  disabled={member.pending_invitation || member.is_pending}
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
                    {member.is_pending && (
                      <Typography.Text type="danger" style={{ fontSize: 10 }}>
                        ({t('taskInfoTab.pendingInvitation')})
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

  // function to focus members input
  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      fetchTeamMembers();
      setTimeout(() => {
        membersInputRef.current?.focus();
      }, 0);
    }
  };

  useEffect(() => {
    getSubscribers();
  }, [task?.id, selectedTaskId]);

  return (
    <Flex gap={8}>
      <Avatars members={subscribers || []} />
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
    </Flex>
  );
};

export default NotifyMemberSelector;

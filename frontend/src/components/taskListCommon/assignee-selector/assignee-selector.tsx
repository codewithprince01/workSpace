import { InputRef } from 'antd/es/input';
import Card from 'antd/es/card';
import Checkbox from 'antd/es/checkbox';
import Divider from 'antd/es/divider';
import Dropdown from 'antd/es/dropdown';
import Empty from 'antd/es/empty';
import Flex from 'antd/es/flex';
import Input from 'antd/es/input';
import List from 'antd/es/list';
import Typography from 'antd/es/typography';
import Button from 'antd/es/button';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleProjectMemberDrawer } from '../../../features/projects/singleProject/members/projectMembersSlice';
import { colors } from '../../../styles/colors';
import { PlusOutlined, UsergroupAddOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { sortByBooleanField, sortBySelection, sortTeamMembers } from '@/utils/sort-team-members';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { useParams } from 'react-router-dom';

interface AssigneeSelectorProps {
  task: IProjectTask;
  groupId: string | null;
}

const AssigneeSelector = ({ task, groupId = null }: AssigneeSelectorProps) => {
  const membersInputRef = useRef<InputRef>(null);
  const lastToggleRef = useRef<Record<string, number>>({});
  const selectedRef = useRef<string[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [optimisticAssigneeIds, setOptimisticAssigneeIds] = useState<string[]>([]);
  const { projectId: routeProjectId } = useParams();
  const { projectId } = useAppSelector(state => state.projectReducer);
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const { t } = useTranslation('task-list-table');

  const dispatch = useAppDispatch();

  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const { loadingAssignees } = useAppSelector(state => state.taskReducer);

  const filteredMembersData = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  const getMemberKey = (member: any) => String(member?.team_member_id || member?.id || '');
  const getMemberByAnyKey = (memberKey: string) =>
    (members?.data || []).find(m => {
      const teamMemberKey = String((m as any)?.team_member_id || '');
      const userKey = String((m as any)?.id || '');
      return memberKey === teamMemberKey || memberKey === userKey;
    });

  const getTaskAssigneeIds = () =>
    (task?.assignees || [])
      .map((assignee: any) => String(assignee?.id || assignee?.team_member_id || ''))
      .filter(Boolean);

  const resolvedProjectId = String(projectId || task?.project_id || routeProjectId || '');

  const resolveAssigneeUserId = (selectedKey: string): string | null => {
    if (!selectedKey) return null;

    const member = getMemberByAnyKey(selectedKey) as any;
    if (member?.user_id) return String(member.user_id);
    if (member?.id && String(member.id) === selectedKey) return String(member.id);
    if (member?.id && String(member.team_member_id || '') === selectedKey) return String(member.id);

    const taskAssignee = (task?.assignees || []).find((a: any) => {
      const teamMemberId = String(a?.team_member_id || '');
      const userId = String(a?.id || '');
      return selectedKey === teamMemberId || selectedKey === userId;
    });
    if (taskAssignee?.id) return String(taskAssignee.id);
    return null;
  };

  const toUserAssigneeIds = (ids: string[]): string[] =>
    Array.from(new Set(ids.map(id => resolveAssigneeUserId(id) || id).filter(Boolean)));

  const isMemberSelected = (memberKey: string, sourceIds?: string[]) => {
    const selected = sourceIds || optimisticAssigneeIds;
    const selectedUsers = new Set(toUserAssigneeIds(selected));
    const memberUserId = resolveAssigneeUserId(memberKey) || memberKey;
    return selectedUsers.has(memberUserId);
  };

  useEffect(() => {
    const ids = getTaskAssigneeIds();
    selectedRef.current = ids;
    setOptimisticAssigneeIds(ids);
    // Only reset on task change; do not reset on every assignees prop churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const handleInviteProjectMemberDrawer = () => {
    dispatch(toggleProjectMemberDrawer());
  };

  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      const assignees = toUserAssigneeIds(getTaskAssigneeIds());
      const membersData = (members?.data || []).map(member => ({
        ...member,
        selected: isMemberSelected(getMemberKey(member), assignees),
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

  const handleMemberChange = async (e: CheckboxChangeEvent | null, memberId: string) => {
    if (!memberId || !task?.id) return;
    const socketMemberId = String((getMemberByAnyKey(memberId) as any)?.team_member_id || memberId);
    const memberUserId = resolveAssigneeUserId(memberId) || memberId;

    const now = Date.now();
    const lastAt = lastToggleRef.current[memberId] || 0;
    if (now - lastAt < 180) return;
    lastToggleRef.current[memberId] = now;

    const currentAssignees = toUserAssigneeIds(
      selectedRef.current.length
        ? selectedRef.current
        : optimisticAssigneeIds.length
          ? optimisticAssigneeIds
          : getTaskAssigneeIds()
    );

    const checked =
      e?.target.checked ??
      !currentAssignees.includes(memberUserId);

    const source = selectedRef.current.length ? selectedRef.current : currentAssignees;
    const nextAssignees = checked
      ? source.includes(memberUserId)
        ? source
        : [...source, memberUserId]
      : source.filter(id => id !== memberUserId);

    // Instant UI response
    selectedRef.current = nextAssignees;
    setOptimisticAssigneeIds(nextAssignees);

    const body = {
      team_member_id: socketMemberId,
      project_id: resolvedProjectId || undefined,
      task_id: task.id,
      reporter_id: currentSession?.id || undefined,
      mode: checked ? 0 : 1,
      parent_task: task.parent_task_id,
    };

    socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));

    // REST fallback: persist assignment even when socket response is delayed/missed
    try {
      const assigneeUserIds = nextAssignees
        .map(memberKey => resolveAssigneeUserId(memberKey))
        .filter(Boolean);

      await apiClient.put(`${API_BASE_URL}/tasks/${task.id}`, {
        assignees: assigneeUserIds,
      });
    } catch (error) {
      // keep optimistic state; socket/live refresh will reconcile
      console.warn('Task assignee REST fallback failed:', error);
    }
  };

  const checkMemberSelected = (memberId: string) => {
    if (!memberId) return false;
    return isMemberSelected(memberId);
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
                key={getMemberKey(member)}
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-start',
                  padding: '4px 8px',
                  border: 'none',
                  cursor: member.pending_invitation ? 'not-allowed' : 'pointer',
                }}
                onClick={(e) => {
                  if (!member.pending_invitation) {
                    e.stopPropagation();
                    handleMemberChange(null, getMemberKey(member));
                  }
                }}
              >
                <Checkbox
                  id={getMemberKey(member)}
                  checked={checkMemberSelected(getMemberKey(member))}
                  onChange={e => {
                    e.stopPropagation();
                    handleMemberChange(e, getMemberKey(member));
                  }}
                  disabled={member.pending_invitation}
                  onClick={e => {
                    e.stopPropagation();
                    // Fallback path: some builds fail to trigger onChange consistently in this dropdown.
                    handleMemberChange(null, getMemberKey(member));
                  }}
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

        <Divider style={{ marginBlock: 0 }} />

        <Button
          icon={<UsergroupAddOutlined />}
          type="text"
          style={{
            color: colors.skyBlue,
            border: 'none',
            backgroundColor: colors.transparent,
            width: '100%',
          }}
          onClick={handleInviteProjectMemberDrawer}
        >
          {t('assigneeSelectorInviteButton')}
        </Button>

        {/* <Divider style={{ marginBlock: 8 }} /> */}

        {/* <Button
          type="primary"
          style={{ alignSelf: 'flex-end' }}
          size="small"
          onClick={handleAssignMembers}
        >
          {t('okButton')}
        </Button> */}
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
        onClick={e => e.stopPropagation()}
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

export default AssigneeSelector;

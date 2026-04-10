import { CaretDownFilled } from '@/shared/antd-imports';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputRef,
  List,
  Space,
  Typography,
} from '@/shared/antd-imports';
import { useMemo, useRef, useState, useCallback } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '@/styles/colors';
import CustomAvatar from '@components/CustomAvatar';
import { useTranslation } from 'react-i18next';
import { setMembers } from '@/features/tasks/tasks.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';

const MembersFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const membersInputRef = useRef<InputRef>(null);

  const { projectId } = useAppSelector(state => state.projectReducer);
  const taskAssignees = useAppSelector(state => state.taskReducer.taskAssignees);
  const { t } = useTranslation('task-list-filters');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const selectedCount = taskAssignees.filter(m => m.selected).length;
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredMembersData = useMemo(() => {
    return taskAssignees.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [taskAssignees, searchQuery]);

  const handleSelectedMember = useCallback(
    (memberId: string, checked: boolean) => {
      if (!projectId) return;

      const updatedMembers = taskAssignees.map(member =>
        member.id === memberId ? { ...member, selected: checked } : member
      );
      
      dispatch(setMembers(updatedMembers as any));
      dispatch(fetchTasksV3(projectId));
    },
    [dispatch, projectId, taskAssignees]
  );

  const membersDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={membersInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchInputPlaceholder')}
        />

        <List style={{ padding: 0, maxHeight: 250, overflow: 'auto' }}>
          {filteredMembersData.length ? (
            filteredMembersData.map(member => (
              <List.Item
                className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                key={member.id}
                onClick={() => handleSelectedMember(member.id, !member.selected)}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '4px 8px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Checkbox
                  id={member.id}
                  checked={member.selected}
                  onChange={e => handleSelectedMember(member.id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <CustomAvatar avatarName={member.name || ''} avatarUrl={member.avatar_url} />
                </div>
                <Flex vertical>
                  {member.name}
                  <Typography.Text style={{ fontSize: 12, color: colors.lightGray }}>
                    {member.email}
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

  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        membersInputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => membersDropdownContent}
      onOpenChange={handleMembersDropdownOpen}
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
          {t('membersText')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default MembersFilterDropdown;


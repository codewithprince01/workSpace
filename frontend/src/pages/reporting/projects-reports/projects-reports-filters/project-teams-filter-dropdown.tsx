import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CaretDownFilled } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchTeams } from '@/features/teams/teamSlice';
import {
  fetchProjectData,
  setAllProjectTeams,
} from '@/features/reporting/projectReports/project-reports-slice';
import { ITeamGetResponse } from '@/types/teams/team.type';

const ProjectTeamsFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const inputRef = useRef<InputRef>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelected, setLocalSelected] = useState<{ id: string; name: string }[]>([]);

  const { teamsList, loading: teamsLoading } = useAppSelector(state => state.teamReducer);
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);

  useEffect(() => {
    if (teamsList.length === 0 && !teamsLoading) {
      dispatch(fetchTeams());
    }
  }, [dispatch]);

  const handleOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  };

  const filteredTeams = useMemo(
    () =>
      teamsList.filter(t =>
        (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [teamsList, searchQuery]
  );

  const isChecked = useCallback(
    (team: ITeamGetResponse) => localSelected.some(t => t.id === team.id),
    [localSelected]
  );

  const handleToggle = useCallback(
    (team: ITeamGetResponse) => {
      if (!team.id) return;
      setLocalSelected(prev => {
        const exists = prev.some(t => t.id === team.id);
        const updated = exists
          ? prev.filter(t => t.id !== team.id)
          : [...prev, { id: team.id!, name: team.name || '' }];
        dispatch(setAllProjectTeams(updated));
        dispatch(fetchProjectData());
        return updated;
      });
    },
    [dispatch]
  );

  const handleSelectAll = useCallback(() => {
    const all = filteredTeams.filter(t => t.id).map(t => ({ id: t.id!, name: t.name || '' }));
    setLocalSelected(all);
    dispatch(setAllProjectTeams(all));
    dispatch(fetchProjectData());
  }, [dispatch, filteredTeams]);

  const handleClearAll = useCallback(() => {
    setLocalSelected([]);
    dispatch(setAllProjectTeams([]));
    dispatch(fetchProjectData());
  }, [dispatch]);

  const selectedCount = localSelected.length;
  const label =
    selectedCount === 0
      ? 'All Teams'
      : selectedCount === 1
        ? localSelected[0].name || 'Team'
        : `${selectedCount} Teams`;

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 260 } }}>
      <Flex vertical gap={8}>
        {/* Label + Input */}
        <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>
          Search by name
        </Typography.Text>
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder="Search by name"
          size="small"
        />

        {/* Select All | Clear All */}
        <Flex align="center">
          <Typography.Link style={{ fontSize: 12 }} onClick={handleSelectAll}>
            Select All
          </Typography.Link>
          <Typography.Text style={{ margin: '0 6px', color: '#999' }}>|</Typography.Text>
          <Typography.Link
            style={{ fontSize: 12, color: '#ff4d4f' }}
            onClick={handleClearAll}
          >
            Clear All
          </Typography.Link>
        </Flex>

        {/* Team list */}
        <List style={{ padding: 0 }} loading={teamsLoading}>
          {filteredTeams.length ? (
            filteredTeams.map(team => {
              const checked = isChecked(team);
              return (
                <List.Item
                  className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                  key={team.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    gap: 8,
                    padding: '4px 8px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleToggle(team)}
                >
                  <Flex align="center" gap={8} style={{ width: '100%' }}>
                    {/* Checkbox only visible when checked */}
                    <Checkbox
                      checked={checked}
                      onChange={e => {
                        e.stopPropagation();
                        handleToggle(team);
                      }}
                      style={{
                        visibility: checked ? 'visible' : 'hidden',
                        width: checked ? 'auto' : 0,
                        minWidth: checked ? 16 : 0,
                        overflow: 'hidden',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                    />
                    {/* Team name */}
                    <Typography.Text style={{ flex: 1 }}>{team.name}</Typography.Text>
                    {/* Green active dot */}
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#52c41a',
                        flexShrink: 0,
                      }}
                    />
                  </Flex>
                </List.Item>
              );
            })
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </List>
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => dropdownContent}
      onOpenChange={handleOpenChange}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        loading={teamsLoading}
        style={
          selectedCount > 0 || isDropdownOpen
            ? { borderColor: '#1890ff', color: '#1890ff' }
            : {}
        }
      >
        {label}
      </Button>
    </Dropdown>
  );
};

export default ProjectTeamsFilterDropdown;

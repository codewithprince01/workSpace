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
  Badge,
} from '@/shared/antd-imports';
import { CaretDownFilled, SearchOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchProjectData,
  setSelectedProjectTeams,
} from '@/features/reporting/projectReports/project-reports-slice';

const ProjectTeamsFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const inputRef = useRef<InputRef>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    allTeams: teamsList,
    isFilterLoading: teamsLoading,
    selectedProjectTeams: localSelected,
  } = useAppSelector(state => state.projectReportsReducer);

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
    (team: any) => localSelected.some(t => String(t.id) === String(team.id)),
    [localSelected]
  );

  const handleToggle = useCallback(
    (team: any) => {
      const exists = localSelected.some(t => String(t.id) === String(team.id));
      const updated = exists
        ? localSelected.filter(t => String(t.id) !== String(team.id))
        : [...localSelected, team];
      
      dispatch(setSelectedProjectTeams(updated));
      dispatch(fetchProjectData());
    },
    [dispatch, localSelected]
  );

  const selectedCount = localSelected.length;
  const label =
    selectedCount === 0
      ? 'Team'
      : selectedCount === 1
        ? localSelected[0].name
        : `${localSelected[0].name} (+${selectedCount - 1})`;

  const dropdownContent = (
    <Card 
        style={{ 
            backgroundColor: '#1d1d1d', 
            border: '1px solid #333', 
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            minWidth: '220px'
        }} 
        styles={{ body: { padding: '4px 0' } }}
    >
      <div style={{ padding: '8px 12px' }}>
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder="Search by name"
          prefix={<SearchOutlined style={{ color: '#888' }} />}
          style={{ backgroundColor: '#262626', border: '1px solid #333', color: '#fff' }}
        />
      </div>

      <List style={{ padding: 0, maxHeight: '300px', overflowY: 'auto' }} loading={teamsLoading}>
        {filteredTeams.length ? (
          filteredTeams.map(team => (
            <div 
                key={String(team.id)}
                onClick={() => handleToggle(team)}
                style={{ 
                    padding: '8px 16px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    background: isChecked(team) ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                    transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#262626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked(team) ? 'rgba(24, 144, 255, 0.1)' : 'transparent'}
            >
                <Checkbox
                    checked={isChecked(team)}
                    className="premium-checkbox"
                />
                <Flex align="center" gap={10} style={{ marginLeft: 12, flex: 1 }}>
                    {team.color && (
                        <div
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: team.color,
                                flexShrink: 0,
                            }}
                        />
                    )}
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: isChecked(team) ? 600 : 400 }}>{team.name}</span>
                </Flex>
            </div>
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#888' }}>No teams found</span>} />
        )}
      </List>
      
      {selectedCount > 0 && (
          <div 
            style={{ padding: '8px 16px', borderTop: '1px solid #333', textAlign: 'center' }}
            onClick={(e) => {
                e.stopPropagation();
                dispatch(setSelectedProjectTeams([]));
                dispatch(fetchProjectData());
            }}
          >
            <Button type="text" size="small" style={{ color: '#888', fontSize: '12px' }}>Clear All</Button>
          </div>
      )}
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
        icon={<CaretDownFilled style={{ fontSize: '10px' }} />}
        iconPosition="end"
        loading={teamsLoading}
        style={{
            backgroundColor: isDropdownOpen ? '#262626' : '#1d1d1d',
            borderColor: selectedCount > 0 || isDropdownOpen ? '#1890ff' : '#333',
            color: selectedCount > 0 || isDropdownOpen ? '#1890ff' : '#bfbfbf',
            borderRadius: '6px',
            height: '32px',
            fontSize: '13px',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }}
      >
        <span>{label}</span>
        {selectedCount > 1 && (
            <Badge 
                count={selectedCount} 
                style={{ 
                    backgroundColor: '#1890ff', 
                    color: '#fff', 
                    minWidth: '18px', 
                    height: '18px', 
                    lineHeight: '18px', 
                    fontSize: '10px' 
                }} 
            />
        )}
      </Button>
    </Dropdown>
  );
};

export default ProjectTeamsFilterDropdown;

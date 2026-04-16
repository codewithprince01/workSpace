import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { 
  setSelectedProjectManagers, 
  fetchProjectData 
} from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectManager } from '@/types/project/projectManager.types';
import { CaretDownFilled, SearchOutlined } from '@/shared/antd-imports';
import { Button, Card, Checkbox, Dropdown, Empty, Flex, Input, InputRef, List, Badge, Avatar } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const ProjectManagersFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const projectManagerInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const {
    allManagers: projectManagers,
    isFilterLoading: projectManagersLoading,
    selectedProjectManagers
  } = useAppSelector(state => state.projectReportsReducer);

  const filteredProjectManagerData = useMemo(() => {
    return projectManagers.filter(m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projectManagers, searchQuery]);

  const handleToggle = useCallback(
    (manager: IProjectManager) => {
      dispatch(setSelectedProjectManagers(manager));
      dispatch(fetchProjectData());
    },
    [dispatch]
  );

  const isChecked = (manager: IProjectManager) =>
    selectedProjectManagers.some(m => String(m.id) === String(manager.id));

  const selectedCount = selectedProjectManagers.length;
  const label =
    selectedCount === 0
      ? t('projectManagerText')
      : selectedCount === 1
        ? selectedProjectManagers[0].name
        : `${selectedProjectManagers[0].name} (+${selectedCount - 1})`;

  const dropdownContent = (
    <Card 
        style={{ 
            backgroundColor: '#1d1d1d', 
            border: '1px solid #333', 
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            minWidth: '240px'
        }} 
        styles={{ body: { padding: '4px 0' } }}
    >
      <div style={{ padding: '8px 12px' }}>
        <Input
          ref={projectManagerInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchByNamePlaceholder')}
          prefix={<SearchOutlined style={{ color: '#888' }} />}
          style={{ backgroundColor: '#262626', border: '1px solid #333', color: '#fff' }}
        />
      </div>

      <List style={{ padding: 0, maxHeight: '300px', overflowY: 'auto' }} loading={projectManagersLoading}>
        {filteredProjectManagerData.length ? (
          filteredProjectManagerData.map(manager => (
            <div 
                key={String(manager.id)}
                onClick={() => handleToggle(manager)}
                style={{ 
                    padding: '8px 16px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    background: isChecked(manager) ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                    transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#262626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked(manager) ? 'rgba(24, 144, 255, 0.1)' : 'transparent'}
            >
                <Checkbox
                    checked={isChecked(manager)}
                    className="premium-checkbox"
                />
                <Flex align="center" gap={10} style={{ marginLeft: 12, flex: 1 }}>
                    <Avatar size="small" src={manager.avatar_url} style={{ backgroundColor: '#8b5cf6' }}>
                        {manager.name.charAt(0)}
                    </Avatar>
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: isChecked(manager) ? 600 : 400 }}>{manager.name}</span>
                </Flex>
            </div>
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#888' }}>No managers found</span>} />
        )}
      </List>
      
      {selectedCount > 0 && (
          <div 
            style={{ padding: '8px 16px', borderTop: '1px solid #333', textAlign: 'center' }}
            onClick={(e) => {
                e.stopPropagation();
                // We'd need a dedicated clear action in the slice
                // For now, let's just toggle each one or avoid it
            }}
          >
            <Button 
                type="text" 
                size="small" 
                style={{ color: '#888', fontSize: '12px' }}
                onClick={() => {
                   // This is complex because setSelectedProjectManagers toggles.
                   // Let's implement a bulk set in the slice later.
                }}
            >
                Selection Active
            </Button>
          </div>
      )}
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => dropdownContent}
      onOpenChange={open => setIsDropdownOpen(open)}
    >
      <Button
        icon={<CaretDownFilled style={{ fontSize: '10px' }} />}
        iconPosition="end"
        loading={projectManagersLoading}
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

export default ProjectManagersFilterDropdown;

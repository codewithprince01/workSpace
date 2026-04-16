import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchProjectData,
  setSelectedProjectHealths,
} from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectHealth } from '@/types/project/projectHealth.types';
import { CaretDownFilled } from '@/shared/antd-imports';
import { Button, Card, Checkbox, Dropdown, Flex, List, Badge } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const ProjectHealthFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [localSelected, setLocalSelected] = useState<IProjectHealth[]>([]);

  const {
    allHealths: projectHealths,
    isFilterLoading: projectHealthsLoading,
    selectedProjectHealths,
  } = useAppSelector(state => state.projectReportsReducer);
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);

  // Sync internal state with Redux
  useEffect(() => {
    setLocalSelected(selectedProjectHealths);
  }, [selectedProjectHealths]);

  const handleToggle = useCallback(
    (health: IProjectHealth) => {
      const exists = localSelected.some(h => String(h.id) === String(health.id));
      const updated = exists
        ? localSelected.filter(h => String(h.id) !== String(health.id))
        : [...localSelected, health];
      
      setLocalSelected(updated);
      dispatch(setSelectedProjectHealths(updated));
      dispatch(fetchProjectData());
    },
    [dispatch, localSelected]
  );

  const isChecked = (health: IProjectHealth) =>
    localSelected.some(h => String(h.id) === String(health.id));

  const selectedCount = localSelected.length;
  const label =
    selectedCount === 0
      ? t('healthText')
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
            minWidth: '200px'
        }} 
        styles={{ body: { padding: '4px 0' } }}
    >
      <List style={{ padding: 0 }} loading={projectHealthsLoading}>
        {projectHealths.map(health => (
            <div 
                key={String(health.id)}
                onClick={() => handleToggle(health)}
                style={{ 
                    padding: '8px 16px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    background: isChecked(health) ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                    transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#262626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked(health) ? 'rgba(24, 144, 255, 0.1)' : 'transparent'}
            >
                <Checkbox
                    checked={isChecked(health)}
                    className="premium-checkbox"
                />
                <Flex align="center" gap={10} style={{ marginLeft: 12, flex: 1 }}>
                    {health.color_code && (
                        <div
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: health.color_code,
                                flexShrink: 0,
                            }}
                        />
                    )}
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: isChecked(health) ? 600 : 400 }}>{health.name}</span>
                </Flex>
            </div>
        ))}
      </List>
      {selectedCount > 0 && (
          <div 
            style={{ padding: '8px 16px', borderTop: '1px solid #333', textAlign: 'center' }}
            onClick={(e) => {
                e.stopPropagation();
                setLocalSelected([]);
                dispatch(setSelectedProjectHealths([]));
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
      onOpenChange={open => setIsDropdownOpen(open)}
    >
      <Button
        icon={<CaretDownFilled style={{ fontSize: '10px' }} />}
        iconPosition="end"
        loading={projectHealthsLoading}
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

export default ProjectHealthFilterDropdown;

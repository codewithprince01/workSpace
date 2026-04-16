import React, { useCallback, useEffect, useState } from 'react';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import {
  fetchProjectData,
  setSelectedProjectHealths,
} from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectHealth } from '@/types/project/projectHealth.types';
import { CaretDownFilled } from '@/shared/antd-imports';
import { Button, Card, Checkbox, Dropdown, Flex, List } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const ProjectHealthFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [localSelected, setLocalSelected] = useState<IProjectHealth[]>([]);

  const {
    projectHealths,
    loading: projectHealthsLoading,
    initialized,
  } = useAppSelector(state => state.projectHealthReducer);
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);

  // Fetch only once
  useEffect(() => {
    if (!initialized && !projectHealthsLoading) {
      dispatch(fetchProjectHealth());
    }
  }, [dispatch, initialized, projectHealthsLoading]);

  const handleToggle = useCallback(
    (health: IProjectHealth) => {
      setLocalSelected(prev => {
        const exists = prev.some(h => h.id === health.id);
        const updated = exists
          ? prev.filter(h => h.id !== health.id)
          : [...prev, health];
        dispatch(setSelectedProjectHealths(updated));
        dispatch(fetchProjectData());
        return updated;
      });
    },
    [dispatch]
  );

  const isChecked = (health: IProjectHealth) =>
    localSelected.some(h => h.id === health.id);

  const selectedCount = localSelected.length;
  const label =
    selectedCount === 0
      ? t('healthText')
      : selectedCount === 1
        ? localSelected[0].name || t('healthText')
        : `${selectedCount} Healths`;

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 0 } }}>
      <List style={{ padding: 0 }} loading={projectHealthsLoading}>
        {projectHealths.map(health => (
          <List.Item
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            key={health.id}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Checkbox
              checked={isChecked(health)}
              onChange={() => handleToggle(health)}
              style={{ width: '100%' }}
            >
              <Flex align="center" gap={8}>
                {/* Color dot from health.color_code */}
                {health.color_code && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: health.color_code,
                      flexShrink: 0,
                    }}
                  />
                )}
                {health.name}
              </Flex>
            </Checkbox>
          </List.Item>
        ))}
      </List>
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
        icon={<CaretDownFilled />}
        iconPosition="end"
        loading={projectHealthsLoading}
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

export default ProjectHealthFilterDropdown;

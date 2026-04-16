import React, { useCallback, useEffect, useState } from 'react';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import {
  fetchProjectData,
  setSelectedProjectStatuses,
} from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectStatus } from '@/types/project/projectStatus.types';
import { CaretDownFilled } from '@/shared/antd-imports';
import { Button, Card, Checkbox, Dropdown, Flex, List } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const ProjectStatusFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [localSelected, setLocalSelected] = useState<IProjectStatus[]>([]);

  const {
    projectStatuses,
    loading: projectStatusesLoading,
    initialized,
  } = useAppSelector(state => state.projectStatusesReducer);
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);

  // Fetch only once — guard with `initialized`
  useEffect(() => {
    if (!initialized && !projectStatusesLoading) {
      dispatch(fetchProjectStatuses());
    }
  }, [dispatch, initialized, projectStatusesLoading]);

  const handleToggle = useCallback(
    (status: IProjectStatus) => {
      setLocalSelected(prev => {
        const exists = prev.some(s => s.id === status.id);
        const updated = exists
          ? prev.filter(s => s.id !== status.id)
          : [...prev, status];
        dispatch(setSelectedProjectStatuses(updated));
        dispatch(fetchProjectData());
        return updated;
      });
    },
    [dispatch]
  );

  const isChecked = (status: IProjectStatus) =>
    localSelected.some(s => s.id === status.id);

  const selectedCount = localSelected.length;
  const label =
    selectedCount === 0
      ? t('statusText')
      : selectedCount === 1
        ? localSelected[0].name || t('statusText')
        : `${selectedCount} Statuses`;

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 0 } }}>
      <List style={{ padding: 0 }} loading={projectStatusesLoading}>
        {projectStatuses.map(status => (
          <List.Item
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            key={status.id}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Checkbox
              checked={isChecked(status)}
              onChange={() => handleToggle(status)}
              style={{ width: '100%' }}
            >
              <Flex align="center" gap={8}>
                {/* Color dot from status.color_code */}
                {status.color_code && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: status.color_code,
                      flexShrink: 0,
                    }}
                  />
                )}
                {status.name}
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
        loading={projectStatusesLoading}
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

export default ProjectStatusFilterDropdown;

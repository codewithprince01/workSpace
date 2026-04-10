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
} from '@/shared/antd-imports';
import { useMemo, useRef, useState, useCallback } from 'react';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { ITaskLabel } from '@/types/tasks/taskLabel.type';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setLabels } from '@/features/tasks/tasks.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';

const LabelsFilterDropdown = (props: { labels: ITaskLabel[] }) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-filters');
  const labelInputRef = useRef<InputRef>(null);

  const { projectId } = useAppSelector(state => state.projectReducer);
  const selectedLabels = useAppSelector(state => state.taskReducer.labels);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const selectedCount = selectedLabels.filter(l => l.selected).length;
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLabelList = useMemo(() => {
    return selectedLabels.filter(label => 
      label.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [selectedLabels, searchQuery]);

  const handleSelectedLabel = useCallback(
    (labelId: string, checked: boolean) => {
      if (!projectId) return;

      const updatedLabels = selectedLabels.map(label =>
        label.id === labelId ? { ...label, selected: checked } : label
      );
      
      dispatch(setLabels(updatedLabels as any));
      dispatch(fetchTasksV3(projectId));
    },
    [dispatch, projectId, selectedLabels]
  );

  const handleLabelsDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => labelInputRef.current?.focus(), 0);
    }
  };

  const labelsDropdownContent = (
    <Card
      className="custom-card"
      styles={{
        body: { padding: 8, width: 260, maxHeight: 250, overflow: 'hidden', overflowY: 'auto' },
      }}
    >
      <Flex vertical gap={8}>
        <Input
          ref={labelInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('searchInputPlaceholder')}
        />

        <List style={{ padding: 0 }}>
          {filteredLabelList.length ? (
            filteredLabelList.map(label => (
              <List.Item
                className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                key={label.id}
                onClick={() => handleSelectedLabel(label.id || '', !label.selected)}
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  gap: 8,
                  padding: '4px 8px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Checkbox
                  id={label.id}
                  checked={label.selected}
                  onChange={e => handleSelectedLabel(label.id || '', e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />

                <Flex gap={8}>
                  <Badge color={label.color_code} />
                  {label.name}
                </Flex>
              </List.Item>
            ))
          ) : (
            <Empty description={t('noLabelsFound')} />
          )}
        </List>
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => labelsDropdownContent}
      onOpenChange={handleLabelsDropdownOpen}
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
          {t('labelsText')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default LabelsFilterDropdown;


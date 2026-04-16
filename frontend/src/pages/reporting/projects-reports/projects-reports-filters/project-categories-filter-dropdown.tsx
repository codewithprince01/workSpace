import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categoriesApiService } from '@/api/settings/categories/categories.api.service';
import {
  fetchProjectData,
  setSelectedProjectCategories,
  setAllProjectCategories,
} from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectCategoryViewModel } from '@/types/project/projectCategory.types';
import { CaretDownFilled } from '@/shared/antd-imports';
import {
  Badge, Button, Card, Checkbox, Dropdown,
  Empty, Flex, Input, InputRef, List, Typography,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const ProjectCategoriesFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const inputRef = useRef<InputRef>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<IProjectCategoryViewModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [localSelected, setLocalSelected] = useState<IProjectCategoryViewModel[]>([]);

  const { mode: themeMode } = useAppSelector(state => state.themeReducer);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await categoriesApiService.getCategoriesByOrganization();
        if (res.done) setCategories(res.body as IProjectCategoryViewModel[]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  };

  const filteredCategories = useMemo(
    () =>
      searchQuery.trim()
        ? categories.filter(c =>
            (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
          )
        : categories,
    [categories, searchQuery]
  );

  const isChecked = useCallback(
    (cat: IProjectCategoryViewModel) => localSelected.some(c => c.id === cat.id),
    [localSelected]
  );

  const handleToggle = useCallback(
    (cat: IProjectCategoryViewModel) => {
      setLocalSelected(prev => {
        const exists = prev.some(c => c.id === cat.id);
        const updated = exists ? prev.filter(c => c.id !== cat.id) : [...prev, cat];
        dispatch(setAllProjectCategories(updated));
        dispatch(fetchProjectData());
        return updated;
      });
    },
    [dispatch]
  );

  const selectedCount = localSelected.length;
  const label =
    selectedCount === 0
      ? t('categoryText')
      : selectedCount === 1
        ? localSelected[0].name || t('categoryText')
        : `${selectedCount} Categories`;

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 240 } }}>
      <Flex vertical gap={8}>
        {/* Search — useful since categories can be many */}
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchByCategoryPlaceholder')}
          size="small"
        />
        <List style={{ padding: 0, maxHeight: 220, overflowY: 'auto' }} loading={loading}>
          {filteredCategories.length ? (
            filteredCategories.map(cat => (
              <List.Item
                className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                key={cat.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '4px 8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Checkbox
                  checked={isChecked(cat)}
                  onChange={() => handleToggle(cat)}
                  style={{ width: '100%' }}
                >
                  <Flex gap={8} align="center">
                    <Badge color={cat.color_code || '#8c8c8c'} />
                    {cat.name}
                  </Flex>
                </Checkbox>
              </List.Item>
            ))
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
        loading={loading}
        style={selectedCount > 0 || isDropdownOpen ? { borderColor: '#1890ff', color: '#1890ff' } : {}}
      >
        {label}
      </Button>
    </Dropdown>
  );
};

export default ProjectCategoriesFilterDropdown;

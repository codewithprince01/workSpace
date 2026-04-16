import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  fetchProjectData,
  setSelectedProjectCategories,
} from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectCategoryViewModel } from '@/types/project/projectCategory.types';
import { CaretDownFilled, SearchOutlined } from '@/shared/antd-imports';
import {
  Badge, Button, Card, Checkbox, Dropdown,
  Empty, Flex, Input, InputRef, List
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const ProjectCategoriesFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const inputRef = useRef<InputRef>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    allCategories: categories,
    isFilterLoading: loading,
    selectedProjectCategories: localSelected,
  } = useAppSelector(state => state.projectReportsReducer);

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
    (cat: IProjectCategoryViewModel) => localSelected.some(c => String(c.id) === String(cat.id)),
    [localSelected]
  );

  const handleToggle = useCallback(
    (cat: IProjectCategoryViewModel) => {
      const exists = localSelected.some(c => String(c.id) === String(cat.id));
      const updated = exists
        ? localSelected.filter(c => String(c.id) !== String(cat.id))
        : [...localSelected, cat];
      
      dispatch(setSelectedProjectCategories(updated));
      dispatch(fetchProjectData());
    },
    [dispatch, localSelected]
  );

  const selectedCount = localSelected.length;
  const label =
    selectedCount === 0
      ? t('categoryText')
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
          placeholder={t('searchByCategoryPlaceholder')}
          prefix={<SearchOutlined style={{ color: '#888' }} />}
          style={{ backgroundColor: '#262626', border: '1px solid #333', color: '#fff' }}
        />
      </div>

      <List style={{ padding: 0, maxHeight: '300px', overflowY: 'auto' }} loading={loading}>
        {filteredCategories.length ? (
          filteredCategories.map(cat => (
            <div 
                key={String(cat.id)}
                onClick={() => handleToggle(cat)}
                style={{ 
                    padding: '8px 16px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    background: isChecked(cat) ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                    transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#262626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked(cat) ? 'rgba(24, 144, 255, 0.1)' : 'transparent'}
            >
                <Checkbox
                    checked={isChecked(cat)}
                    className="premium-checkbox"
                />
                <Flex align="center" gap={10} style={{ marginLeft: 12, flex: 1 }}>
                    {cat.color_code && (
                        <div
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: cat.color_code,
                                flexShrink: 0,
                            }}
                        />
                    )}
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: isChecked(cat) ? 600 : 400 }}>{cat.name}</span>
                </Flex>
            </div>
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#888' }}>No categories found</span>} />
        )}
      </List>
      
      {selectedCount > 0 && (
          <div 
            style={{ padding: '8px 16px', borderTop: '1px solid #333', textAlign: 'center' }}
            onClick={(e) => {
                e.stopPropagation();
                dispatch(setSelectedProjectCategories([]));
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
        loading={loading}
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

export default ProjectCategoriesFilterDropdown;

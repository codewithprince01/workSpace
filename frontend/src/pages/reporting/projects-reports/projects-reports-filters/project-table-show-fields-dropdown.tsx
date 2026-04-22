import React, { useState } from 'react';
import { MoreOutlined } from '@/shared/antd-imports';
import { Button, Card, Checkbox, Dropdown, List, Space } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleColumnHidden } from '@/features/reporting/projectReports/project-reports-table-column-slice/project-reports-table-column-slice';
import { useTranslation } from 'react-i18next';
import { themeWiseColor } from '@/utils/themeWiseColor';

const ProjectTableShowFieldsDropdown = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { t } = useTranslation('reporting-projects-filters');

  const columnsVisibility = useAppSelector(state => state.projectReportsTableColumnsReducer);
  const dispatch = useAppDispatch();

  const columnKeys = Object.keys(columnsVisibility).filter(
    key => key !== 'project' && key !== 'projectManager'
  );

  // Replace the showFieldsDropdownContent with a menu items structure
  const menuItems = {
    items: columnKeys.map(key => ({
      key,
      label: (
        <Space>
          <Checkbox
            checked={columnsVisibility[key]}
            onClick={() => dispatch(toggleColumnHidden(key))}
          >
            {t(`${key}Text`)}
          </Checkbox>
        </Space>
      ),
    })),
  };

  return (
    <Dropdown menu={menuItems} trigger={['click']} onOpenChange={open => setIsDropdownOpen(open)}>
      <Button
        icon={<MoreOutlined />}
        style={{
            backgroundColor: isDropdownOpen ? themeWiseColor('#e6f7ff', '#262626', themeMode) : themeWiseColor('#f5f5f5', '#1d1d1d', themeMode),
            borderColor: isDropdownOpen ? '#1890ff' : themeWiseColor('#d9d9d9', '#333', themeMode),
            color: isDropdownOpen ? '#1890ff' : themeWiseColor('#595959', '#bfbfbf', themeMode),
            borderRadius: '6px',
            height: '32px',
            fontSize: '13px',
            transition: 'all 0.3s',
        }}
      >
        {t('showFieldsText')}
      </Button>
    </Dropdown>
  );
};

export default ProjectTableShowFieldsDropdown;

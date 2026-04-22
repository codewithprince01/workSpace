import { RightOutlined } from '@/shared/antd-imports';
import { ConfigProvider, Flex, Menu, MenuProps } from '@/shared/antd-imports';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { adminCenterItems } from '../admin-center-constants';
import './sidebar.css';

import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';

const AdminCenterSidebar: React.FC = () => {
  const { t } = useTranslation('admin-center/sidebar');
  const location = useLocation();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  type MenuItem = Required<MenuProps>['items'][number];
  const menuItems = adminCenterItems;

  const items: MenuItem[] = [
    ...menuItems.map(item => ({
      key: item.key,
      label: (
        <Flex gap={8} justify="space-between" className="admin-center-sidebar-button">
          <Flex gap={8} align="center">
            <span style={{ color: themeWiseColor('#595959', '#8c8c8c', themeMode), display: 'flex', alignItems: 'center' }}>
                {item.icon}
            </span>
            <Link 
                to={`/worklenz/admin-center/${item.endpoint}`}
                style={{ color: themeWiseColor('#262626', '#d1d1d1', themeMode), fontSize: '14px', fontWeight: 500 }}
            >
                {t(item.name)}
            </Link>
          </Flex>
          <RightOutlined style={{ fontSize: 10, color: themeWiseColor('#bfbfbf', '#595959', themeMode) }} />
        </Flex>
      ),
    })),
  ];

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            itemHoverBg: themeWiseColor('rgba(0,0,0,0.04)', 'rgba(255,255,255,0.04)', themeMode),
            itemSelectedBg: themeWiseColor('#e6f7ff', 'rgba(24, 144, 255, 0.1)', themeMode),
            itemSelectedColor: '#1890ff',
            borderRadius: 8,
            itemMarginBlock: 4,
            itemPaddingInline: 12,
          },
        },
      }}
    >
      <Menu
        items={items}
        selectedKeys={[location.pathname.split('/worklenz/admin-center/')[1] || '']}
        mode="vertical"
        style={{ border: 'none', width: '100%', backgroundColor: 'transparent' }}
      />
    </ConfigProvider>
  );
};

export default AdminCenterSidebar;

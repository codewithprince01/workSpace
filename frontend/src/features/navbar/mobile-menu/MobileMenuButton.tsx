import {
  CalendarOutlined,
  HomeOutlined,
  MenuOutlined,
  ProjectOutlined,
  ReadOutlined,
} from '@/shared/antd-imports';
import { Button, Card, Dropdown, Flex, MenuProps, Space, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { NavLink } from 'react-router-dom';
import InviteButton from '../invite/InviteButton';
import SwitchTeamButton from '../switch-team/SwitchTeamButton';
import { useProjectRole } from '@/services/project-role/projectRole.service';
import { navRoutes } from '../navRoutes';
import { useAuthService } from '@/hooks/useAuth';
// custom css
import './mobileMenu.css';

const MobileMenuButton = () => {
  // localization
  const { t } = useTranslation('navbar');
  const { projectRole } = useProjectRole();
  const currentSession = useAuthService().getCurrentSession();

  const iconMap: Record<string, React.ReactNode> = {
    home: React.createElement(HomeOutlined),
    projects: React.createElement(ProjectOutlined),
    calendar: React.createElement(CalendarOutlined),
    reporting: React.createElement(ReadOutlined),
  };

  // Filter nav links based on permissions
  const filteredNavLinks = navRoutes.filter(link => {
    if (
      !link.freePlanFeature &&
      currentSession?.subscription_type === 'free'
    ) {
      return false;
    }
    if (link.adminOnly && !projectRole.canAccessSettings) {
      return false;
    }
    if (link.requiresReportsAccess && !projectRole.canAccessReports) {
      return false;
    }
    return true;
  });

  const mobileMenu: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="mobile-menu-card" bordered={false} style={{ width: 230 }}>
          {filteredNavLinks.map((navEl, index) => (
            <NavLink key={index} to={navEl.path}>
              <Typography.Text strong>
                <Space>
                  {iconMap[navEl.name]}
                  {t(navEl.name)}
                </Space>
              </Typography.Text>
            </NavLink>
          ))}

          <Flex
            className="mobile-menu-actions"
            vertical
            gap={12}
            style={{
              width: '100%',
              margin: 0,
              padding: '12px 14px 6px',
              boxSizing: 'border-box',
            }}
          >
            {/* Mobile menu intentionally hides upgrade action for now */}
            {/* <Button
              className="mobile-menu-upgrade-btn"
              style={{
                backgroundColor: colors.lightBeige,
                color: 'black',
              }}
            >
              {t('upgradePlan')}
            </Button> */}
            {projectRole.canInviteMembers && (
              <div className="mobile-menu-action-row">
                <InviteButton />
              </div>
            )}
            <div className="mobile-menu-action-row mobile-menu-switch-team">
              <SwitchTeamButton />
            </div>
          </Flex>
        </Card>
      ),
    },
  ];

  return (
    <Dropdown
      overlayClassName="mobile-menu-dropdown"
      menu={{ items: mobileMenu }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Button className="borderless-icon-btn" icon={<MenuOutlined style={{ fontSize: 20 }} />} />
    </Dropdown>
  );
};

export default MobileMenuButton;

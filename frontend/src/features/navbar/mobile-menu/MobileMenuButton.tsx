import {
  ClockCircleOutlined,
  HomeOutlined,
  MenuOutlined,
  ProjectOutlined,
  QuestionCircleOutlined,
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
// custom css
import './mobileMenu.css';

const MobileMenuButton = () => {
  // localization
  const { t } = useTranslation('navbar');
  const { projectRole } = useProjectRole();

  const navLinks = [
    {
      name: 'home',
      icon: React.createElement(HomeOutlined),
    },
    {
      name: 'projects',
      icon: React.createElement(ProjectOutlined),
    },
    {
      name: 'schedule',
      icon: React.createElement(ClockCircleOutlined),
    },
    {
      name: 'reporting',
      icon: React.createElement(ReadOutlined),
      requiresReportsAccess: true,
    },
    {
      name: 'help',
      icon: React.createElement(QuestionCircleOutlined),
    },
  ];

  // Filter nav links based on permissions
  const filteredNavLinks = navLinks.filter(link => {
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
            <NavLink key={index} to={`/worklenz/${navEl.name}`}>
              <Typography.Text strong>
                <Space>
                  {navEl.icon}
                  {t(navEl.name)}
                </Space>
              </Typography.Text>
            </NavLink>
          ))}

          <Flex
            vertical
            gap={12}
            style={{
              width: '90%',
              marginInlineStart: 12,
              marginBlock: 6,
            }}
          >
            <Button
              style={{
                backgroundColor: colors.lightBeige,
                color: 'black',
              }}
            >
              {t('upgradePlan')}
            </Button>
            {projectRole.canInviteMembers && <InviteButton />}
            <SwitchTeamButton />
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

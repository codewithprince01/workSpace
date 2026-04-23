import React, { useState } from 'react';
import { Avatar, Button, Checkbox, Dropdown, Input, Menu, Typography, theme } from '@/shared/antd-imports';
import { UserAddOutlined, UsergroupAddOutlined } from '@/shared/antd-imports';
import './add-members-dropdown.css';
import { AvatarNamesMap } from '@/shared/constants';

const AddMembersDropdown: React.FC = () => {
  const [checkedMembers, setCheckedMembers] = useState<string[]>([]);
  const { token } = theme.useToken();

  const handleCheck = (member: string) => {
    setCheckedMembers(prevChecked =>
      prevChecked.includes(member)
        ? prevChecked.filter(m => m !== member)
        : [...prevChecked, member]
    );
  };

  const inviteItems = [
    {
      key: '1',
      label: (
        <Checkbox
          checked={checkedMembers.includes('Invite Member 1')}
          onClick={e => e.stopPropagation()}
          onChange={() => handleCheck('Invite Member 1')}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              style={{
                backgroundColor: AvatarNamesMap['R'],
                width: '28px',
                height: '28px',
                marginRight: '0.5rem',
              }}
            >
              R
            </Avatar>
            <div style={{ lineHeight: '15px', display: 'flex', flexDirection: 'column' }}>
              <Typography.Text>Raveesha Dilanka</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: '80%' }}>
                raveeshadilanka1999@gmail.com
              </Typography.Text>
            </div>
          </div>
        </Checkbox>
      ),
    },
  ];

  const menu = (
    <div
      style={{
        backgroundColor: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        overflow: 'hidden',
        boxShadow: token.boxShadowSecondary,
      }}
    >
      {/* Header / Search */}
      <div style={{ backgroundColor: token.colorBgElevated, padding: '8px 16px' }}>
        <Input placeholder="Search by name" />
      </div>

      {/* Member list */}
      <Menu
        items={inviteItems}
        style={{
          maxHeight: '300px',
          overflowY: 'auto',
          backgroundColor: token.colorBgElevated,
        }}
      />

      <Button
        style={{
          width: '100%',
          backgroundColor: token.colorBgElevated,
          color: token.colorText,
        }}
        type="link"
      >
        <UsergroupAddOutlined /> Invite a new member by email
      </Button>

      {/* Footer */}
      <div
        style={{
          padding: '8px',
          textAlign: 'right',
          backgroundColor: token.colorBgElevated,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Button
          type="primary"
          size="small"
          onClick={() => {
            console.log('Selected Members:', checkedMembers);
          }}
        >
          Ok
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      menu={{ items: inviteItems }}
      trigger={['click']}
      dropdownRender={() => menu}
      overlayClassName="custom-dropdown-menu"
      overlayStyle={{ width: '300px' }}
    >
      <UserAddOutlined />
    </Dropdown>
  );
};

export default AddMembersDropdown;

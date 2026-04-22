import React, { useState, useMemo } from 'react';
import { 
  Checkbox, Input, Dropdown, Button, Space, Typography, 
  Divider, Avatar, Tooltip 
} from '@/shared/antd-imports';
import { 
  SearchOutlined, PlusOutlined, UserOutlined 
} from '@/shared/antd-imports';

const { Text } = Typography;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Member {
  _id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface MemberMultiSelectProps {
  members: Member[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MemberMultiSelect: React.FC<MemberMultiSelectProps> = ({
  members,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = 'Select'
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // ── LOGIC ──────────────────────────────────────────────────

  const memberIdSet = useMemo(() => new Set(members.map(m => m._id)), [members]);

  const selectedMembers = useMemo(() => 
    members.filter(m => selectedIds.includes(m._id)),
    [members, selectedIds]
  );

  const selectedExternalEmails = useMemo(
    () => selectedIds.filter(value => !memberIdSet.has(value)),
    [selectedIds, memberIdSet]
  );

  const filteredMembers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return members.filter(
      member =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const toggleMember = (memberId: string) => {
    const newSelectedIds = selectedIds.includes(memberId)
      ? selectedIds.filter(id => id !== memberId)
      : [...selectedIds, memberId];
    onChange(newSelectedIds);
  };

  const selectedInternalIdsCount = useMemo(
    () => selectedIds.filter(value => memberIdSet.has(value)).length,
    [selectedIds, memberIdSet]
  );

  const isAllSelected = members.length > 0 && selectedInternalIdsCount === members.length;

  const toggleAll = () => {
    if (isAllSelected) {
      onChange(selectedExternalEmails);
    } else {
      onChange([...members.map(m => m._id), ...selectedExternalEmails]);
    }
  };

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isValidExternalEmail = EMAIL_REGEX.test(trimmedQuery);
  const memberByEmail = members.find(m => m.email.toLowerCase() === trimmedQuery);
  const externalEmailSelected = selectedIds.includes(trimmedQuery);

  // ── COMPONENTS ─────────────────────────────────────────────

  const dropdownContent = (
    <div className="cal-member-dropdown">
      <div className="cal-member-search-container">
        <Input
          placeholder="Search or create"
          prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
          className="cal-member-search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="cal-member-list">
        {/* All Members Toggle */}
        <div 
          className="cal-member-item" 
          onClick={toggleAll}
        >
          <Checkbox checked={isAllSelected} className="cal-member-checkbox" />
          <Avatar 
            size={32} 
            icon={<UserOutlined />} 
            className="cal-member-avatar all-members-avatar"
            style={{ backgroundColor: '#1677ff' }}
          />
          <div className="cal-member-info">
            <Text className="cal-member-name">All team members</Text>
            <Text type="secondary" className="cal-member-email">Select everyone in this team</Text>
          </div>
        </div>

        <Divider style={{ margin: '4px 0' }} />

        {/* Individual members */}
        {filteredMembers.map(member => (
          <div 
            key={member._id} 
            className="cal-member-item"
            onClick={() => toggleMember(member._id)}
          >
            <Checkbox 
              checked={selectedIds.includes(member._id)} 
              className="cal-member-checkbox" 
            />
            <Avatar 
              src={member.avatar_url} 
              size={32} 
              className="cal-member-avatar"
            >
              {member.name.charAt(0)}
            </Avatar>
            <div className="cal-member-info">
              <Text className="cal-member-name">{member.name}</Text>
              <Text type="secondary" className="cal-member-email">{member.email}</Text>
            </div>
          </div>
        ))}

        {isValidExternalEmail && !memberByEmail && (
          <div
            className="cal-member-item"
            onClick={() => toggleMember(trimmedQuery)}
          >
            <Checkbox checked={externalEmailSelected} className="cal-member-checkbox" />
            <Avatar
              size={32}
              icon={<UserOutlined />}
              className="cal-member-avatar"
              style={{ backgroundColor: '#595959' }}
            />
            <div className="cal-member-info">
              <Text className="cal-member-name">{trimmedQuery}</Text>
              <Text type="secondary" className="cal-member-email">External email</Text>
            </div>
          </div>
        )}

        {filteredMembers.length === 0 && !(isValidExternalEmail && !memberByEmail) && (
          <div style={{ padding: '12px', textAlign: 'center' }}>
            <Text type="secondary">No members found</Text>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="cal-assignee-outer">
      <Space size={-8} className="cal-avatar-stack">
        {selectedMembers.map(member => (
          <Tooltip title={member.name} key={member._id}>
            <Avatar 
              src={member.avatar_url} 
              size={32} 
              style={{ border: '2px solid #141414', cursor: 'default' }}
            >
              {member.name.charAt(0)}
            </Avatar>
          </Tooltip>
        ))}
        {selectedExternalEmails.map(email => (
          <Tooltip title={email} key={email}>
            <Avatar
              size={32}
              style={{ border: '2px solid #141414', cursor: 'default', backgroundColor: '#595959' }}
            >
              @
            </Avatar>
          </Tooltip>
        ))}
      </Space>

      <Dropdown
        trigger={['click']}
        dropdownRender={() => dropdownContent}
        disabled={disabled}
        overlayClassName="cal-member-popover"
      >
        <Button 
          shape="circle" 
          icon={<PlusOutlined />} 
          size="middle"
          className="cal-plus-btn"
          disabled={disabled}
        />
      </Dropdown>
    </div>
  );
};

export default MemberMultiSelect;

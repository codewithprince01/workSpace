import { Avatar, Tooltip } from '@/shared/antd-imports';
import React, { useCallback, useMemo } from 'react';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { AvatarNamesMap } from '@/shared/constants';

interface AvatarsProps {
  members: InlineMember[];
  maxCount?: number;
}

const Avatars: React.FC<AvatarsProps> = React.memo(({ members, maxCount }) => {
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const renderAvatar = useCallback(
    (member: InlineMember, index: number) => (
      <Tooltip
        key={member.team_member_id || index}
        title={member.end && member.names ? member.names.join(', ') : member.name}
      >
        {member.avatar_url ? (
          <span onClick={stopPropagation}>
            <Avatar src={member.avatar_url} size={28} key={member.team_member_id || index} />
          </span>
        ) : (
          <span onClick={stopPropagation}>
            <Avatar
              size={28}
              key={member.team_member_id || index}
              style={{
                backgroundColor:
                  member.color_code ||
                  AvatarNamesMap[(member.name || '?').charAt(0).toUpperCase()] ||
                  '#1890ff',
                fontSize: '14px',
              }}
            >
              {member.end && member.names ? member.name : member.name?.charAt(0).toUpperCase()}
            </Avatar>
          </span>
        )}
      </Tooltip>
    ),
    [stopPropagation]
  );

  const visibleMembers = useMemo(() => {
    const safeMembers = members || [];
    return maxCount ? safeMembers.slice(0, maxCount) : safeMembers;
  }, [members, maxCount]);

  const avatarElements = useMemo(() => {
    return visibleMembers.map((member, index) => renderAvatar(member, index));
  }, [visibleMembers, renderAvatar]);

  return (
    <div onClick={stopPropagation}>
      <Avatar.Group>{avatarElements}</Avatar.Group>
    </div>
  );
});

Avatars.displayName = 'Avatars';

export default Avatars;

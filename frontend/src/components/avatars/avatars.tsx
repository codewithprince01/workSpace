import { Avatar as AntdAvatar, Tooltip } from '@/shared/antd-imports';
import React, { useCallback, useMemo } from 'react';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import Avatar from '@/components/Avatar';

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
        <span onClick={stopPropagation} style={{ display: 'inline-block' }}>
          <Avatar
            src={member.avatar_url}
            name={member.name || ''}
            size={28}
            backgroundColor={member.color_code}
          />
        </span>
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
      <AntdAvatar.Group>{avatarElements}</AntdAvatar.Group>
    </div>
  );
});

Avatars.displayName = 'Avatars';

export default Avatars;

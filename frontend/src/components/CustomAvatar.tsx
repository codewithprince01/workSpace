import React from 'react';
import { Tooltip } from '@/shared/antd-imports';
import Avatar from '@/components/Avatar';

interface CustomAvatarProps {
  avatarName: string;
  size?: number;
}

const CustomAvatar = React.forwardRef<HTMLDivElement, CustomAvatarProps>(
  ({ avatarName, size = 32 }, ref) => {
    return (
      <Tooltip title={avatarName}>
        <div ref={ref} style={{ display: 'inline-block' }}>
          <Avatar
            name={avatarName}
            size={size}
          />
        </div>
      </Tooltip>
    );
  }
);

CustomAvatar.displayName = 'CustomAvatar';

export default CustomAvatar;

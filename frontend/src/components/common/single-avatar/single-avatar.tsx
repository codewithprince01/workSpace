import React from 'react';
import Avatar from '@/components/Avatar';
import { Flex } from '@/shared/antd-imports';

interface SingleAvatarProps {
  avatarUrl?: string;
  name?: string;
  email?: string;
  size?: number;
}

const SingleAvatar: React.FC<SingleAvatarProps> = ({ avatarUrl, name, email = null, size = 28 }) => {
  return (
    <Avatar
      src={avatarUrl}
      name={name || ''}
      size={size}
      style={{
        marginRight: '8px',
      }}
    />
  );
};

export default SingleAvatar;

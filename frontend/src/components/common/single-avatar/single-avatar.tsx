import { AvatarNamesMap } from '@/shared/constants';
import { Avatar, Flex, Space } from '@/shared/antd-imports';

interface SingleAvatarProps {
  avatarUrl?: string;
  name?: string;
  email?: string;
}

const SingleAvatar: React.FC<SingleAvatarProps> = ({ avatarUrl, name, email = null }) => {
  const firstChar = (name?.charAt(0) || '').toUpperCase();
  const avatarColor = AvatarNamesMap[firstChar] || '#1890ff';

  return (
    <Avatar
      src={avatarUrl}
      size={28}
      style={{
        backgroundColor: avatarUrl ? 'transparent' : avatarColor,
        border: avatarUrl ? 'none' : `1px solid ${avatarColor}`,
        marginRight: '8px',
      }}
    >
      {firstChar}
    </Avatar>
  );
};

export default SingleAvatar;

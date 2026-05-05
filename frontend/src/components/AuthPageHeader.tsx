import { Flex, Typography } from '@/shared/antd-imports';
const logo = '/BritannicaWorkspaceLogo.webp';
import { useAppSelector } from '@/hooks/useAppSelector';

type AuthPageHeaderProp = {
  description: string;
};

// this page header used in only in auth pages
const AuthPageHeader = ({ description }: AuthPageHeaderProp) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  return (
    <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
      <img
        src={logo}
        alt="Britannica Workspace logo"
        style={{ width: '100%', maxWidth: 220, maxHeight: 80, objectFit: 'contain' }}
      />
      <Typography.Text style={{ color: '#8c8c8c', maxWidth: 400, textAlign: 'center' }}>
        {description}
      </Typography.Text>
    </Flex>
  );
};

export default AuthPageHeader;

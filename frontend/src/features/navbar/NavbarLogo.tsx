import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';

const DEFAULT_LOGO = '/BritannicaWorkspaceLogo.webp';

const NavbarLogo = () => {
  const { t } = useTranslation('navbar');
  const teamLogoUrl = useAppSelector((state: RootState) => state.userReducer.team_logo_url);

  return (
    <Link to={'/workspace/home'}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginRight: 16 }}>
        <img
          src={teamLogoUrl || DEFAULT_LOGO}
          alt={t('logoAlt')}
          style={{ 
            height: 'auto',
            maxHeight: 44, 
            maxWidth: 180, 
            objectFit: 'contain'
          }}
        />
      </div>
    </Link>
  );
};

export default NavbarLogo;

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const logo = '/BritannicaWorkspaceLogo.webp';

const NavbarLogo = () => {
  const { t } = useTranslation('navbar');

  return (
    <Link to={'/worklenz/home'}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginRight: 16 }}>
        <img
          src={logo}
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

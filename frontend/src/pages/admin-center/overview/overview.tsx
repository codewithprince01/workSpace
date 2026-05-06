import { EditOutlined, MailOutlined, InfoCircleOutlined, PlusOutlined } from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { Button, Card, Col, Divider, Row, Space, Tooltip, Typography, Upload, message } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import OrganizationAdminsTable from '@/components/admin-center/overview/organization-admins-table/organization-admins-table';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';
import { useTranslation } from 'react-i18next';
import OrganizationName from '@/components/admin-center/overview/organization-name/organization-name';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IOrganization, IOrganizationAdmin } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_admin_center_overview_visit } from '@/shared/worklenz-analytics-events';
import { themeWiseColor } from '@/utils/themeWiseColor';
import Avatar from '@/components/Avatar';

const { Text } = Typography;

const Overview: React.FC = () => {
  const [organization, setOrganization] = useState<IOrganization | null>(null);
  const [organizationAdmins, setOrganizationAdmins] = useState<IOrganizationAdmin[] | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const isSuperAdmin = useAppSelector((state: RootState) => state.superAdminReducer.isSuperAdmin);
  const { t } = useTranslation('admin-center/overview');

  const getOrganizationDetails = async () => {
    try {
      const res = await adminCenterApiService.getOrganizationDetails();
      if (res.done) {
        setOrganization(res.body);
      }
    } catch (error) {
      logger.error('Error getting organization details', error);
    }
  };

  const getOrganizationAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await adminCenterApiService.getOrganizationAdmins();
      if (res.done) {
        setOrganizationAdmins(res.body);
      }
    } catch (error) {
      logger.error('Error getting organization admins', error);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    trackMixpanelEvent(evt_admin_center_overview_visit);
    getOrganizationDetails();
    getOrganizationAdmins();
  }, [trackMixpanelEvent]);

  const cardStyle = {
    borderRadius: '8px',
    marginBottom: '24px',
    backgroundColor: themeWiseColor('#ffffff', '#1e1e1e', themeMode),
    border: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
    width: '100%',
    boxShadow: themeWiseColor('0 2px 8px rgba(0,0,0,0.05)', 'none', themeMode)
  };

  const sectionLabelStyle = {
    fontSize: '14px',
    color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode),
    marginBottom: '20px',
    fontWeight: 500,
    display: 'block'
  };

  const headerTitleStyle = {
    fontSize: '18px',
    fontWeight: 600,
    color: themeWiseColor('#262626', '#fff', themeMode),
    margin: '0 0 16px 0'
  };

  const smallTextStyle = {
    fontSize: '12px',
    color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode),
    lineHeight: '1.5'
  };

  const handleLogoUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await adminCenterApiService.updateOrganizationLogo({
          file: base64,
          file_name: (file as File).name
        });
        
        if (res.done) {
          message.success('Logo updated successfully');
          getOrganizationDetails();
          onSuccess(res.body);
        } else {
          message.error(res.message || 'Failed to update logo');
          onError(new Error(res.message));
        }
      } catch (error) {
        const errorMessage =
          (error as any)?.response?.data?.message ||
          (error as any)?.message ||
          'An error occurred during upload';
        message.error(errorMessage);
        onError(error);
      }
    };
    reader.onerror = (error) => {
      onError(error);
    };
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '16px 0', backgroundColor: themeWiseColor('#ffffff', '#121417', themeMode) }}>
      
      {/* Organization Profile Card */}
      <Card style={cardStyle} bodyStyle={{ padding: '32px' }}>
        <div style={headerTitleStyle}>Organization Profile</div>
        <Divider style={{ margin: '0 0 32px 0', borderColor: themeWiseColor('#f0f0f0', '#303030', themeMode), opacity: 1 }} />
        
        <div style={{ display: 'flex', gap: '80px', alignItems: 'flex-start' }}>
          {/* Logo Column */}
          {isSuperAdmin && (
            <div style={{ flex: '0 0 240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                <span style={{ color: themeWiseColor('#595959', '#8c8c8c', themeMode), fontSize: 14, fontWeight: 500 }}>Logo</span>
                <Tooltip title="Organization logo used in navbar and billing">
                  <InfoCircleOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode), fontSize: 14 }} />
                </Tooltip>
              </div>
              
              <Upload.Dragger
                style={{
                  width: '240px',
                  height: '120px',
                  borderRadius: '8px',
                  border: `1px dashed ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
                  background: themeWiseColor('#fafafa', 'transparent', themeMode),
                  overflow: 'hidden'
                }}
                showUploadList={false}
                customRequest={handleLogoUpload}
                accept="image/*"
              >
                {organization?.logo_url ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: themeWiseColor('#fff', '#000', themeMode) }}>
                    <img src={organization.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div style={{ padding: '24px 0' }}>
                      <PlusOutlined style={{ fontSize: '28px', color: themeWiseColor('#bfbfbf', '#8c8c8c', themeMode), marginBottom: 8 }} />
                      <div style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode), fontSize: '14px', fontWeight: 500 }}>Upload Logo</div>
                      <div style={{ fontSize: '10px', color: themeWiseColor('#bfbfbf', '#595959', themeMode), marginTop: 2 }}>PNG, JPG, WEBP</div>
                  </div>
                )}
              </Upload.Dragger>
              
              <div style={{ ...smallTextStyle, marginTop: 20 }}>
                Recommended: PNG format, 400×120px (landscape),<br /> under 500KB
              </div>
              <div style={{ ...smallTextStyle, marginTop: 16, opacity: 0.7 }}>
                 Used in navbar and synced to client portal
              </div>
            </div>
          )}

          {/* Organization Name Column */}
          <div style={{ flex: '0 0 240px' }}>
            <div style={{ ...sectionLabelStyle, color: themeWiseColor('#595959', '#8c8c8c', themeMode), marginBottom: 20 }}>Organization Name</div>
            <div style={{ marginTop: 8 }}>
                <OrganizationName
                    themeMode={themeMode}
                    name={organization?.name || ''}
                    t={t}
                    refetch={getOrganizationDetails}
                    isEmbedded
                />
            </div>
          </div>

          {/* Organization Owner Column */}
          <div style={{ flex: '1' }}>
            <div style={{ ...sectionLabelStyle, color: themeWiseColor('#595959', '#8c8c8c', themeMode), marginBottom: 20 }}>Organization Owner</div>
            <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Avatar 
                        name={organization?.owner_name || ''} 
                        size={40} 
                        isDarkMode={themeMode === 'dark'} 
                    />
                    <Text style={{ fontSize: 16, color: themeWiseColor('#262626', '#fff', themeMode), fontWeight: 500 }}>{organization?.owner_name || '-'}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MailOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode), fontSize: 14 }} />
                    <Text style={{ color: themeWiseColor('#595959', '#fff', themeMode), fontSize: 14, opacity: 0.85 }}>{organization?.email || '-'}</Text>
                </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Organization Admins Card */}
      <Card style={cardStyle} bodyStyle={{ padding: '0px' }}>
        <div style={{ padding: '24px 24px 0 24px' }}>
            <div style={headerTitleStyle}>Organization Admins</div>
        </div>
        <Divider style={{ margin: '20px 0 0 0', borderColor: themeWiseColor('#f0f0f0', '#303030', themeMode), opacity: 1 }} />
        <OrganizationAdminsTable
          organizationAdmins={organizationAdmins}
          loading={loadingAdmins}
          themeMode={themeMode}
        />
      </Card>
    </div>
  );
};

export default Overview;

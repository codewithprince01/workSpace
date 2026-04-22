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

const { Text } = Typography;

const Overview: React.FC = () => {
  const [organization, setOrganization] = useState<IOrganization | null>(null);
  const [organizationAdmins, setOrganizationAdmins] = useState<IOrganizationAdmin[] | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
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
    borderRadius: '4px',
    marginBottom: '24px',
    backgroundColor: themeMode === 'dark' ? '#121417' : '#ffffff',
    border: 'none',
    width: '100%'
  };

  const sectionLabelStyle = {
    fontSize: '14px',
    color: '#8c8c8c',
    marginBottom: '20px',
    fontWeight: 500,
    display: 'block'
  };

  const headerTitleStyle = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    margin: '0 0 16px 0'
  };

  const smallTextStyle = {
    fontSize: '12px',
    color: '#8c8c8c',
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
    <div style={{ width: '100%', minHeight: '100vh', padding: '16px 24px', backgroundColor: themeMode === 'dark' ? '#121417' : '#f0f2f5' }}>
      
      {/* Organization Profile Card */}
      <Card style={cardStyle} bodyStyle={{ padding: '32px' }}>
        <div style={headerTitleStyle}>Organization Profile</div>
        <Divider style={{ margin: '0 0 32px 0', borderColor: '#303030', opacity: 0.5 }} />
        
        <div style={{ display: 'flex', gap: '80px', alignItems: 'flex-start' }}>
          {/* Logo Column */}
          <div style={{ flex: '0 0 240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
              <span style={{ color: '#8c8c8c', fontSize: 14, fontWeight: 500 }}>Logo</span>
              <Tooltip title="Organization logo used in navbar and billing">
                <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
              </Tooltip>
            </div>
            
            <Upload.Dragger
              style={{
                width: '240px',
                height: '120px',
                borderRadius: '4px',
                border: '1px dashed #434343',
                background: 'transparent',
                overflow: 'hidden'
              }}
              showUploadList={false}
              customRequest={handleLogoUpload}
              accept="image/*"
            >
              {organization?.logo_url ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                  <img src={organization.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ padding: '24px 0' }}>
                    <PlusOutlined style={{ fontSize: '28px', color: '#8c8c8c', marginBottom: 8 }} />
                    <div style={{ color: '#8c8c8c', fontSize: '14px', fontWeight: 500 }}>Upload Logo</div>
                    <div style={{ fontSize: '10px', color: '#595959', marginTop: 2 }}>PNG, JPG, WEBP</div>
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

          {/* Organization Name Column */}
          <div style={{ flex: '0 0 240px' }}>
            <div style={{ ...sectionLabelStyle, color: '#8c8c8c', marginBottom: 20 }}>Organization Name</div>
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
            <div style={{ ...sectionLabelStyle, color: '#8c8c8c', marginBottom: 20 }}>Organization Owner</div>
            <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 16, color: '#ffffff', fontWeight: 500 }}>{organization?.owner_name || '-'}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MailOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
                    <Text style={{ color: '#ffffff', fontSize: 14, opacity: 0.85 }}>{organization?.email || '-'}</Text>
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
        <Divider style={{ margin: '20px 0 0 0', borderColor: '#303030', opacity: 0.5 }} />
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

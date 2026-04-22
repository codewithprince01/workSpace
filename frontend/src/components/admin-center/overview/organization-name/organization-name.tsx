import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import logger from '@/utils/errorLogger';
import { EnterOutlined, EditOutlined } from '@/shared/antd-imports';
import { Card, Button, Tooltip, Typography } from '@/shared/antd-imports';
import TextArea from 'antd/es/input/TextArea';
import { TFunction } from 'i18next';
import { useState, useEffect } from 'react';
import { themeWiseColor } from '@/utils/themeWiseColor';

const { Text } = Typography;

interface OrganizationNameProps {
  themeMode: string;
  name: string;
  t: TFunction;
  refetch: () => void;
  isEmbedded?: boolean;
}

const OrganizationName = ({ themeMode, name, t, refetch, isEmbedded }: OrganizationNameProps) => {
  const [isEditable, setIsEditable] = useState(false);
  const [newName, setNewName] = useState(name);

  useEffect(() => {
    setNewName(name);
  }, [name]);

  const handleBlur = () => {
    if (newName.trim() === '') {
      setNewName(name);
      setIsEditable(false);
      return;
    }
    if (newName !== name) {
      updateOrganizationName();
    }
    setIsEditable(false);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewName(e.target.value);
  };

  const updateOrganizationName = async () => {
    try {
      const trimmedName = newName.trim();
      const res = await adminCenterApiService.updateOrganizationName({ name: trimmedName });
      if (res.done) {
        refetch();
      }
    } catch (error) {
      logger.error('Error updating organization name', error);
      setNewName(name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setNewName(name);
      setIsEditable(false);
    }
  };

  const content = (
    <div style={{ paddingTop: isEmbedded ? 0 : '8px' }}>
      <div style={{ marginBottom: '8px' }}>
        {isEditable ? (
          <div style={{ position: 'relative' }}>
            <TextArea
              style={{
                height: '32px',
                paddingRight: '40px',
                resize: 'none',
                borderRadius: '4px',
                backgroundColor: themeWiseColor('#ffffff', 'rgba(255,255,255,0.05)', themeMode),
                borderColor: themeWiseColor('#d9d9d9', '#303030', themeMode),
                color: themeWiseColor('#262626', '#ffffff', themeMode)
              }}
              onPressEnter={handleBlur}
              value={newName}
              onChange={handleNameChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={100}
              placeholder={t('enterOrganizationName')}
            />
            <Button
              icon={<EnterOutlined style={{ color: '#1890ff' }} />}
              type="text"
              style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 8px',
                color: '#1890ff',
              }}
              onClick={handleBlur}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text style={{ fontSize: isEmbedded ? 15 : 14, color: themeWiseColor('#262626', '#fafafa', themeMode), fontWeight: isEmbedded ? 500 : 400 }}>{name}</Text>
            <Tooltip title={t('edit')}>
              <Button
                onClick={() => setIsEditable(true)}
                size="small"
                type="text"
                icon={<EditOutlined style={{ fontSize: 13 }} />}
                style={{ padding: '0', color: '#1890ff', height: 'auto', display: 'flex', alignItems: 'center' }}
              />
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );

  if (isEmbedded) return content;

  return (
    <Card style={{ 
        backgroundColor: themeWiseColor('#ffffff', '#1e1e1e', themeMode), 
        border: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
        borderRadius: '8px'
    }}>
      <Typography.Title level={5} style={{ margin: 0, marginBottom: '0.5rem', color: themeWiseColor('#262626', '#fff', themeMode) }}>
        {t('name')}
      </Typography.Title>
      {content}
    </Card>
  );
};

export default OrganizationName;

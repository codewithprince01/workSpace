import React, { useEffect, useState } from 'react';
import { Button, Drawer, Dropdown } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { DownOutlined, EditOutlined, ImportOutlined } from '@/shared/antd-imports';
import TemplateDrawer from '@/components/common/template-drawer/template-drawer';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  setProjectData,
  setProjectId,
  toggleProjectDrawer,
} from '@/features/project/project-drawer.slice';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { evt_projects_create_click, evt_project_import_from_template_click } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
interface CreateProjectButtonProps {
  className?: string;
}

const CreateProjectButton: React.FC<CreateProjectButtonProps> = ({ className }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'worklenz' | 'custom'>('worklenz');
  const [projectImporting, setProjectImporting] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const location = useLocation();
  const { t } = useTranslation('create-first-project-form');

  useEffect(() => {
    const pathKey = location.pathname.split('/').pop();
    setCurrentPath(pathKey ?? 'home');
  }, [location]);

  const handleTemplateDrawerOpen = () => {
    trackMixpanelEvent(evt_project_import_from_template_click);
    setIsTemplateDrawerOpen(true);
  };

  const handleTemplateDrawerClose = () => {
    setIsTemplateDrawerOpen(false);
    setCurrentTemplateId('');
    setSelectedType('worklenz');
  };

  const handleTemplateSelect = (templateId: string) => {
    setCurrentTemplateId(templateId);
  };

  const createFromWorklenzTemplate = async () => {
    if (!currentTemplateId || currentTemplateId === '') return;
    try {
      setProjectImporting(true);
    } catch (e) {
      console.error(e);
    } finally {
      setProjectImporting(false);
      handleTemplateDrawerClose();
    }
  };

  const createFromCustomTemplate = async () => {
    if (!currentTemplateId || currentTemplateId === '') return;
    try {
      setProjectImporting(true);
    } catch (e) {
      console.error(e);
    } finally {
      setProjectImporting(false);
      handleTemplateDrawerClose();
    }
  };

  const setCreatedProjectTemplate = async () => {
    if (!currentTemplateId || currentTemplateId === '') return;
    try {
      setProjectImporting(true);
      if (selectedType === 'worklenz') {
        const res = await projectTemplatesApiService.createFromWorklenzTemplate({
          template_id: currentTemplateId,
        });
        if (res.done) {
          navigate(
            `/worklenz/projects/${res.body.project_id}?tab=tasks-list&pinned_tab=tasks-list`
          );
        }
      } else {
        const res = await projectTemplatesApiService.createFromCustomTemplate({
          template_id: currentTemplateId,
        });
        if (res.done) {
          navigate(
            `/worklenz/projects/${res.body.project_id}?tab=tasks-list&pinned_tab=tasks-list`
          );
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProjectImporting(false);
      handleTemplateDrawerClose();
    }
  };

  const dropdownItems = [
    {
      key: 'template',
      label: (
        <div className="w-full m-0 p-0" onClick={handleTemplateDrawerOpen}>
          <ImportOutlined className="mr-2" />
          {currentPath === 'home' ? t('templateButton') : t('createFromTemplate')}
        </div>
      ),
    },
  ];

  const handleCreateProject = () => {
    trackMixpanelEvent(evt_projects_create_click);
    dispatch(setProjectId(null));
    dispatch(setProjectData({} as IProjectViewModel));
    setTimeout(() => {
      dispatch(toggleProjectDrawer());
    }, 300);
  };

  return (
    <div className={className}>
      <Dropdown.Button
        type="primary"
        trigger={['click']}
        icon={<DownOutlined />}
        onClick={handleCreateProject}
        menu={{ items: dropdownItems }}
        style={{ height: 40 }}
        buttonsRender={([leftButton, rightButton]) => [
          React.cloneElement(leftButton as React.ReactElement, {
            style: {
              borderRadius: '8px 0 0 8px',
              height: 40,
              background: '#1677ff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(22,119,255,0.2)',
              fontWeight: 600,
            }
          }),
          React.cloneElement(rightButton as React.ReactElement, {
            style: {
              borderRadius: '0 8px 8px 0',
              height: 40,
              background: '#1677ff',
              border: 'none',
              borderLeft: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 2px 8px rgba(22,119,255,0.2)',
              color: '#fff'
            }
          }),
        ]}
      >
        <EditOutlined /> {t('createProject')}
      </Dropdown.Button>

      <Drawer
        title={t('templateDrawerTitle')}
        width={1000}
        onClose={handleTemplateDrawerClose}
        open={isTemplateDrawerOpen}
        footer={
          <div className="flex justify-end px-4 py-2.5">
            <Button className="mr-2" onClick={handleTemplateDrawerClose}>
              {t('cancel')}
            </Button>
            <Button type="primary" loading={projectImporting} onClick={setCreatedProjectTemplate}>
              {t('create')}
            </Button>
          </div>
        }
      >
        <TemplateDrawer
          showBothTabs={true}
          templateSelected={handleTemplateSelect}
          selectedTemplateType={setSelectedType}
        />
      </Drawer>
    </div>
  );
};

export default CreateProjectButton;

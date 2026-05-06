import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  DatePicker,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  notification,
  Popconfirm,
  Skeleton,
  Space,
  Switch,
  Tooltip,
  Typography,
  InfoCircleOutlined,
} from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { fetchClients } from '@/features/settings/client/clientSlice';
import {
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectsQuery,
  useUpdateProjectMutation,
} from '@/api/projects/projects.v1.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { projectColors } from '@/lib/project/project-constants';
import { setProject, setProjectId } from '@/features/project/project.slice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';

import ProjectManagerDropdown from '../project-manager-dropdown/project-manager-dropdown';
import ProjectBasicInfo from './project-basic-info/project-basic-info';
import ProjectHealthSection from './project-health-section/project-health-section';
import ProjectStatusSection from './project-status-section/project-status-section';
import ProjectCategorySection from './project-category-section/project-category-section';

import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import logger from '@/utils/errorLogger';
import {
  setProjectData,
  toggleProjectDrawer,
  setProjectId as setDrawerProjectId,
} from '@/features/project/project-drawer.slice';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useAuthService } from '@/hooks/useAuth';
import { evt_projects_create } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';

const ProjectDrawer = ({ onClose }: { onClose: () => void }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { t } = useTranslation('project-drawer');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(true);
  const currentSession = useAuthService().getCurrentSession();

  // State
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedProjectManager, setSelectedProjectManager] = useState<ITeamMemberViewModel | null>(
    null
  );
  const [isFormValid, setIsFormValid] = useState<boolean>(true);
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);

  // Selectors
  const { clients, loading: loadingClients } = useAppSelector(state => state.clientReducer);
  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const { isProjectDrawerOpen, projectId, projectLoading, project } = useAppSelector(
    state => state.projectDrawerReducer
  );
  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);

  // API Hooks
  const { refetch: refetchProjects } = useGetProjectsQuery(requestParams);
  const [deleteProject, { isLoading: isDeletingProject }] = useDeleteProjectMutation();
  const [updateProject, { isLoading: isUpdatingProject }] = useUpdateProjectMutation();
  const [createProject, { isLoading: isCreatingProject }] = useCreateProjectMutation();

  const isOwnerorAdmin = useAuthService().isOwnerOrAdmin();
  const { isSuperAdmin } = useAppSelector(state => state.superAdminReducer);
  const canEditProjectSettings = isSuperAdmin || (currentSession?.team_role
    ? ['owner', 'admin'].includes(currentSession.team_role)
    : isOwnerorAdmin);

  const normalizeProjectStatus = useCallback((status?: string) => {
    if (!status) return 'proposed';
    const normalized = status.toLowerCase().replace(/\s+/g, '_');
    if (normalized === 'active') return 'in_progress';
    return normalized;
  }, []);

  const normalizeProjectHealth = useCallback((health?: string) => {
    if (!health) return 'not_set';
    const normalized = health.toLowerCase().replace(/\s+/g, '_');
    if (normalized === 'critical') return 'at_risk';
    return normalized;
  }, []);

  // Memoized values
  const defaultFormValues = useMemo(
    () => ({
      color_code: project?.color_code || projectColors[0],
      status: normalizeProjectStatus(project?.status),
      health: normalizeProjectHealth((project as any)?.health),
      client_id: project?.client_id || null,
      client_name: project?.client_name || null,
      category_id: project?.category_id || null,
      working_days: project?.working_days || 0,
      man_days: project?.man_days || 0,
      hours_per_day_h: Math.floor(project?.hours_per_day || 8),
      hours_per_day_m: Math.round(((project?.hours_per_day || 8) % 1) * 60),
      use_manual_progress: project?.use_manual_progress || false,
      use_weighted_progress: project?.use_weighted_progress || false,
      use_time_progress: project?.use_time_progress || false,
    }),
    [project, normalizeProjectHealth, normalizeProjectStatus]
  );

  const normalizeId = useCallback((value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return value.id || value._id || null;
  }, []);

  const getStatusOverrideKey = useCallback((id: string) => `project_status_override_${id}`, []);

  // Effects
  useEffect(() => {
    const loadInitialData = async () => {
      const fetchPromises = [];
      if (projectCategories.length === 0) fetchPromises.push(dispatch(fetchProjectCategories()));
      if (!clients.data?.length) {
        fetchPromises.push(
          dispatch(fetchClients({ index: 1, size: 5, field: null, order: null, search: null }))
        );
      }
      await Promise.all(fetchPromises);
    };

    loadInitialData();
  }, [
    dispatch,
    projectCategories.length,
    clients.data?.length,
  ]);

  // New effect to handle form population when project data becomes available
  useEffect(() => {
    if (drawerVisible && projectId && project && !projectLoading) {
      console.log('Populating form with project data:', project);
      setEditMode(true);
      
      try {
        const statusOverride =
          projectId && (project as any)?.status === 'active'
            ? localStorage.getItem(getStatusOverrideKey(projectId))
            : null;
        const mappedStatus = normalizeProjectStatus(
          statusOverride || (project as any).status || (project as any).status_name
        );
        const mappedHealth = normalizeProjectHealth((project as any).health);
        const mappedCategoryId = normalizeId(project.category_id);
        const mappedClientId =
          normalizeId(project.client_id) ||
          normalizeId((project as any).client?.id) ||
          normalizeId((project as any).client?._id);
        const mappedClientName = project.client_name || (project as any).client?.name || null;

        form.setFieldsValue({
          ...project,
          status: mappedStatus,
          health: mappedHealth,
          category_id: mappedCategoryId || undefined,
          client_id: mappedClientId || null,
          client_name: mappedClientName,
          start_date: project.start_date ? dayjs(project.start_date) : null,
          end_date: project.end_date ? dayjs(project.end_date) : null,
          hours_per_day_h: Math.floor(project.hours_per_day || 0),
          hours_per_day_m: Math.round(((project.hours_per_day || 0) % 1) * 60),
          working_days: project.working_days || 0,
          use_manual_progress: project.use_manual_progress || false,
          use_weighted_progress: project.use_weighted_progress || false,
          use_time_progress: project.use_time_progress || false,
        });
        
        setSelectedProjectManager(project.project_manager || null);
        setLoading(false);
        console.log('Form populated successfully with project data');
      } catch (error) {
        console.error('Error setting form values:', error);
        logger.error('Error setting form values in project drawer', error);
        setLoading(false);
      }
    } else if (drawerVisible && !projectId) {
      // Creating new project
      console.log('Setting up drawer for new project creation');
      setEditMode(false);
      form.setFieldsValue(defaultFormValues);
      setLoading(false);
    } else if (drawerVisible && projectId && !project && !projectLoading) {
      // Project data failed to load or is empty
      console.warn('Project drawer is visible but no project data available');
      setLoading(false);
    } else if (drawerVisible && projectId) {
      console.log('Drawer visible, waiting for project data to load...');
    }
  }, [
    drawerVisible,
    projectId,
    project,
    projectLoading,
    form,
    defaultFormValues,
    normalizeProjectHealth,
    normalizeProjectStatus,
    normalizeId,
    getStatusOverrideKey,
  ]);

  // Additional effect to handle loading state when project data is being fetched
  useEffect(() => {
    if (drawerVisible && projectId && projectLoading) {
      console.log('Project data is loading, maintaining loading state');
      setLoading(true);
    }
  }, [drawerVisible, projectId, projectLoading]);

  // Define resetForm function early to avoid declaration order issues
  const resetForm = useCallback(() => {
    setEditMode(false);
    form.resetFields();
    setSelectedProjectManager(null);
  }, [form]);

  useEffect(() => {
    if (!isProjectDrawerOpen || !drawerVisible) return;

    const startDate = form.getFieldValue('start_date');
    const endDate = form.getFieldValue('end_date');

    if (startDate && endDate) {
      const days = calculateWorkingDays(
        dayjs.isDayjs(startDate) ? startDate : dayjs(startDate),
        dayjs.isDayjs(endDate) ? endDate : dayjs(endDate)
      );
      form.setFieldsValue({ working_days: days });
    }
  }, [form, isProjectDrawerOpen, drawerVisible]);

  // Handlers
  const handleFormSubmit = async (values: any) => {
    if (!canEditProjectSettings) {
      notification.warning({ message: t('noPermission') });
      return;
    }

    try {
      const mapToLegacyStatus = (status?: string) => {
        const normalized = (status || '').toLowerCase().replace(/\s+/g, '_');
        if (normalized === 'cancelled') return 'cancelled';
        if (normalized === 'on_hold') return 'on_hold';
        if (normalized === 'completed') return 'completed';
        return 'active';
      };

      const mapToLegacyHealth = (health?: string) => {
        const normalized = (health || '').toLowerCase().replace(/\s+/g, '_');
        if (normalized === 'critical') return 'critical';
        if (normalized === 'at_risk' || normalized === 'needs_attention') return 'at_risk';
        return 'good';
      };

      const getErrorMessage = (res: any) =>
        res?.error?.data?.message || res?.error?.message || res?.data?.message || '';

      const isEnumValidationError = (res: any) => {
        const message = String(getErrorMessage(res) || '').toLowerCase();
        return message.includes('not a valid enum value for path `status`') ||
          message.includes('not a valid enum value for path `health`');
      };

      const projectModel: IProjectViewModel = {
        name: values.name,
        color_code: values.color_code,
        status: values.status || 'proposed',
        category_id: values.category_id || null,
        health: values.health || 'not_set',
        notes: values.notes,
        key: values.key,
        client_id: values.client_id,
        client_name: values.client_name,
        start_date: values.start_date,
        end_date: values.end_date,
        working_days: parseInt(values.working_days),
        man_days: parseInt(values.man_days),
        hours_per_day: (parseInt(values.hours_per_day_h) || 0) + (parseInt(values.hours_per_day_m) || 0) / 60,
        project_manager: selectedProjectManager,
        use_manual_progress: values.use_manual_progress || false,
        use_weighted_progress: values.use_weighted_progress || false,
        use_time_progress: values.use_time_progress || false,
      };

      const action =
        editMode && projectId
          ? updateProject({ id: projectId, project: projectModel })
          : createProject(projectModel);

      let response = await action;

      // Backward compatibility fallback for legacy backend enum sets
      if (editMode && projectId && isEnumValidationError(response)) {
        const legacyProjectModel: IProjectViewModel = {
          ...projectModel,
          status: mapToLegacyStatus(projectModel.status),
          health: mapToLegacyHealth(projectModel.health),
        };
        response = await updateProject({ id: projectId, project: legacyProjectModel });
      }

      if (response?.data?.done) {
        if (values.status) {
          const savedProjectId = (projectId || response?.data?.body?.id || '').toString();
          if (savedProjectId) {
            localStorage.setItem(getStatusOverrideKey(savedProjectId), values.status);
          }
        }
        form.resetFields();
        dispatch(toggleProjectDrawer());
        if (!editMode) {
          trackMixpanelEvent(evt_projects_create);
          navigate(
            `/worklenz/projects/${response.data.body.id}?tab=tasks-list&pinned_tab=tasks-list`
          );
        }
        refetchProjects();
        window.location.reload(); // Refresh the page
      } else {
        notification.error({ message: getErrorMessage(response) || 'Failed to save project' });
        logger.error(
          editMode ? 'Error updating project' : 'Error creating project',
          getErrorMessage(response)
        );
      }
    } catch (error) {
      logger.error('Error saving project', error);
    }
  };
  const calculateWorkingDays = (
    startDate: dayjs.Dayjs | null,
    endDate: dayjs.Dayjs | null
  ): number => {
    if (
      !startDate ||
      !endDate ||
      !startDate.isValid() ||
      !endDate.isValid() ||
      startDate.isAfter(endDate)
    ) {
      return 0;
    }

    let workingDays = 0;
    let currentDate = startDate.clone().startOf('day');
    const end = endDate.clone().startOf('day');

    while (currentDate.isBefore(end) || currentDate.isSame(end)) {
      const dayOfWeek = currentDate.day();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      currentDate = currentDate.add(1, 'day');
    }

    return workingDays;
  };

  // Improved handleVisibilityChange to track drawer state without doing form operations
  const handleVisibilityChange = useCallback(
    (visible: boolean) => {
      console.log('Drawer visibility changed:', visible, 'Project ID:', projectId);
      setDrawerVisible(visible);
      
      if (!visible) {
        resetForm();
      } else if (visible && !projectId) {
        // Creating new project - reset form immediately
        console.log('Opening drawer for new project');
        setEditMode(false);
        setLoading(false);
      } else if (visible && projectId) {
        // Editing existing project - loading state will be handled by useEffect
        console.log('Opening drawer for existing project:', projectId);
        setLoading(true);
      }
    },
    [projectId, resetForm]
  );

  const handleDrawerClose = useCallback(() => {
    setLoading(true);
    setDrawerVisible(false);
    resetForm();
    dispatch(setProjectData({} as IProjectViewModel));
    dispatch(setDrawerProjectId(null));
    dispatch(toggleProjectDrawer());
    onClose();
  }, [resetForm, dispatch, onClose]);

  const handleDeleteProject = async () => {
    if (!projectId) return;

    try {
      const res = await deleteProject(projectId);
      if (res?.data?.done) {
        dispatch(setProject({} as IProjectViewModel));
        dispatch(setProjectData({} as IProjectViewModel));
        dispatch(setProjectId(null));
        dispatch(toggleProjectDrawer());
        navigate('/worklenz/projects');
        refetchProjects();
        window.location.reload(); // Refresh the page
      } else {
        notification.error({ message: res?.data?.message });
        logger.error('Error deleting project', res?.data?.message);
      }
    } catch (error) {
      logger.error('Error deleting project', error);
    }
  };

  const disabledStartDate = useCallback(
    (current: dayjs.Dayjs) => {
      if (!current) return false;
      const isPast = current.isBefore(dayjs().startOf('day'));
      const endDate = form.getFieldValue('end_date');
      return isPast || (endDate ? current.isAfter(dayjs(endDate)) : false);
    },
    [form]
  );

  const disabledEndDate = useCallback(
    (current: dayjs.Dayjs) => {
      if (!current) return false;
      const startDate = form.getFieldValue('start_date');
      return startDate ? current.isBefore(dayjs(startDate)) : current.isBefore(dayjs().startOf('day'));
    },
    [form]
  );

  const handleFieldsChange = (_: any, allFields: any[]) => {
    const isValid = allFields.every(field => field.errors.length === 0);
    setIsFormValid(isValid);
  };

  return (
    <Drawer
      // loading={loading}
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {projectId ? t('editProject') : t('createProject')}
        </Typography.Text>
      }
      open={isProjectDrawerOpen}
      onClose={handleDrawerClose}
      destroyOnHidden
      afterOpenChange={handleVisibilityChange}
      footer={
        <Flex justify="space-between">
          <Space>
            {editMode && canEditProjectSettings && (
              <Popconfirm
                title={t('deleteConfirmation')}
                description={t('deleteConfirmationDescription')}
                onConfirm={handleDeleteProject}
                okText={t('yes')}
                cancelText={t('no')}
              >
                <Button danger type="dashed" loading={isDeletingProject}>
                  {t('delete')}
                </Button>
              </Popconfirm>
            )}
          </Space>
          <Space>
            {canEditProjectSettings && (
              <Button
                type="primary"
                onClick={() => form.submit()}
                loading={isCreatingProject || isUpdatingProject}
                disabled={!isFormValid}
              >
                {editMode ? t('update') : t('create')}
              </Button>
            )}
          </Space>
        </Flex>
      }
    >
      {!canEditProjectSettings && (
        <Alert message={t('noPermission')} type="warning" showIcon style={{ marginBottom: 16 }} />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFormSubmit}
        initialValues={defaultFormValues}
        onFieldsChange={handleFieldsChange}
      >
        <Skeleton active paragraph={{ rows: 12 }} loading={loading || projectLoading}>
          <ProjectBasicInfo
            editMode={editMode}
            project={project}
            form={form}
            disabled={!canEditProjectSettings}
          />
          <ProjectStatusSection
            form={form}
            t={t}
            disabled={!canEditProjectSettings}
          />
          <ProjectHealthSection
            form={form}
            t={t}
            disabled={!canEditProjectSettings}
          />
          <ProjectCategorySection
            categories={projectCategories}
            form={form}
            t={t}
            disabled={!canEditProjectSettings}
          />

          <Form.Item name="notes" label={t('notes')}>
            <Input.TextArea
              placeholder={t('enterNotes')}
              disabled={!canEditProjectSettings}
            />
          </Form.Item>

          <Form.Item name="project_manager" label={t('projectManager')} layout="horizontal">
            <ProjectManagerDropdown
              selectedProjectManager={selectedProjectManager}
              setSelectedProjectManager={setSelectedProjectManager}
              disabled={!canEditProjectSettings}
            />
          </Form.Item>

          <Form.Item name="date" layout="horizontal">
            <Flex gap={8}>
              <Form.Item name="start_date" label={t('startDate')} style={{ flex: 1 }}>
                <DatePicker
                  showTime={{ format: 'hh:mm A', use12Hours: true }}
                  format="YYYY-MM-DD hh:mm A"
                  disabledDate={disabledStartDate}
                  disabled={!canEditProjectSettings}
                  style={{ width: '100%' }}
                  onChange={date => {
                    const endDate = form.getFieldValue('end_date');
                    if (date && endDate) {
                      const days = calculateWorkingDays(date, endDate);
                      form.setFieldsValue({ working_days: days });
                    }
                  }}
                />
              </Form.Item>
              <Form.Item name="end_date" label={t('endDate')} style={{ flex: 1 }}>
                <DatePicker
                  showTime={{ format: 'hh:mm A', use12Hours: true }}
                  format="YYYY-MM-DD hh:mm A"
                  disabledDate={disabledEndDate}
                  disabled={!canEditProjectSettings}
                  style={{ width: '100%' }}
                  onChange={date => {
                    const startDate = form.getFieldValue('start_date');
                    if (startDate && date) {
                      const days = calculateWorkingDays(startDate, date);
                      form.setFieldsValue({ working_days: days });
                    }
                  }}
                />
              </Form.Item>
            </Flex>
          </Form.Item>

          <Form.Item
            name="working_days"
            label={t('estimateWorkingDays')}
            rules={[
              {
                validator: (_, value) => {
                  if (value === undefined || value >= 0) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('workingDaysValidationMessage', { min: 0 })));
                },
              },
            ]}
          >
            <Input type="number" min={0} disabled={!canEditProjectSettings} />
          </Form.Item>

          <Form.Item label={t('hoursPerDay')}>
            <Flex gap={8}>
              <Form.Item
                name="hours_per_day_h"
                noStyle
                rules={[
                  {
                    validator: (_, value) => {
                      if (value === undefined || value === null || value === '' || value >= 0) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('workingDaysValidationMessage', { min: 0 })));
                    },
                  },
                ]}
              >
                <Input
                  type="number"
                  min={0}
                  placeholder={t('hours')}
                  disabled={!canEditProjectSettings}
                  style={{ width: '100%' }}
                  onChange={e => {
                    let value = parseInt(e.target.value);
                    if (value < 0) value = 0;
                    form.setFieldsValue({ hours_per_day_h: value });
                  }}
                />
              </Form.Item>
              <Form.Item
                name="hours_per_day_m"
                noStyle
                rules={[
                  {
                    validator: (_, value) => {
                      if (value === undefined || value === null || value === '' || (value >= 0 && value <= 59)) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('maxMinutesValidationMessage')));
                    },
                  },
                ]}
              >
                <Input
                  type="number"
                  min={0}
                  max={59}
                  placeholder={t('minutes')}
                  disabled={!canEditProjectSettings}
                  style={{ width: '100%' }}
                  onChange={e => {
                    let value = parseInt(e.target.value);
                    if (value > 59) value = 59;
                    if (value < 0) value = 0;
                    form.setFieldsValue({ hours_per_day_m: value });
                  }}
                />
              </Form.Item>
            </Flex>
          </Form.Item>
          {/* <Divider orientation="left">{t('progressSettings')}</Divider>

          <Form.Item
            name="use_manual_progress"
            label={
              <Space>
                <Typography.Text>{t('manualProgress')}</Typography.Text>
                <Tooltip title={t('manualProgressTooltip')}>
                  <Button type="text" size="small" icon={<InfoCircleOutlined />} />
                </Tooltip>
              </Space>
            }
            valuePropName="checked"
          >
            <Switch
              onChange={handleManualProgressChange}
              disabled={!isProjectManager && !isOwnerorAdmin}
            />
          </Form.Item>

          <Form.Item
            name="use_weighted_progress"
            label={
              <Space>
                <Typography.Text>{t('weightedProgress')}</Typography.Text>
                <Tooltip title={t('weightedProgressTooltip')}>
                  <Button type="text" size="small" icon={<InfoCircleOutlined />} />
                </Tooltip>
              </Space>
            }
            valuePropName="checked"
          >
            <Switch
              onChange={handleWeightedProgressChange}
              disabled={!isProjectManager && !isOwnerorAdmin}
            />
          </Form.Item>

          <Form.Item
            name="use_time_progress"
            label={
              <Space>
                <Typography.Text>{t('timeProgress')}</Typography.Text>
                <Tooltip title={t('timeProgressTooltip')}>
                  <Button type="text" size="small" icon={<InfoCircleOutlined />} />
                </Tooltip>
              </Space>
            }
            valuePropName="checked"
          >
            <Switch
              onChange={handleTimeProgressChange}
              disabled={!isProjectManager && !isOwnerorAdmin}
            />
          </Form.Item> */}

          {editMode && (
            <Flex vertical gap={4}>
              <Divider />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('createdAt')}&nbsp;
                <Tooltip title={formatDateTimeWithLocale(project?.created_at || '')}>
                  {calculateTimeDifference(project?.created_at || '')}
                </Tooltip>{' '}
                {t('by')} {project?.project_owner || ''}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('updatedAt')}&nbsp;
                <Tooltip title={formatDateTimeWithLocale(project?.updated_at || '')}>
                  {calculateTimeDifference(project?.updated_at || '')}
                </Tooltip>
              </Typography.Text>
            </Flex>
          )}
        </Skeleton>
      </Form>
    </Drawer>
  );
};

export default ProjectDrawer;

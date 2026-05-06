import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';

// Centralized Ant Design imports
import {
  Button,
  ConfigProvider,
  Flex,
  Tabs,
  PushpinFilled,
  PushpinOutlined,
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getProject, setProjectId, setProjectView } from '@/features/project/project.slice';
import { fetchStatuses, resetStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useSocket } from '@/socket/socketContext';
import ProjectViewHeader from './project-view-header';
import './project-view.css';
import { resetTaskListData } from '@/features/tasks/tasks.slice';
import { resetBoardData } from '@/features/board/board-slice';
import { resetTaskManagement } from '@/features/task-management/task-management.slice';
import { resetGrouping } from '@/features/task-management/grouping.slice';
import { resetSelection } from '@/features/task-management/selection.slice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import { tabItems, updateTabLabels } from '@/lib/project/project-view-constants';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  resetTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { resetState as resetEnhancedKanbanState } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { setProjectId as setInsightsProjectId } from '@/features/projects/insights/project-insights.slice';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import { useTranslation } from 'react-i18next';
import { useTimerInitialization } from '@/hooks/useTimerInitialization';
import { useProjectRole } from '@/services/project-role/projectRole.service';

// Import critical components synchronously to avoid suspense interruptions
import TaskDrawer from '@components/task-drawer/task-drawer';

// Lazy load non-critical components with better error handling
const DeleteStatusDrawer = React.lazy(
  () => import('@/components/project-task-filters/delete-status-drawer/delete-status-drawer')
);
const PhaseDrawer = React.lazy(() => import('@/features/projects/singleProject/phase/PhaseDrawer'));
const StatusDrawer = React.lazy(
  () => import('@/components/project-task-filters/create-status-drawer/create-status-drawer')
);
const ProjectMemberDrawer = React.lazy(
  () => import('@/components/projects/project-member-invite-drawer/project-member-invite-drawer')
);

const ProjectView = React.memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { projectId } = useParams();
  const { t, i18n } = useTranslation('project-view');
  const { socket, connected } = useSocket();

  // Debug: Log projectId changes
  useEffect(() => {
    console.log('🆔 [PROJECT-VIEW] projectId from URL params:', projectId);
  }, [projectId]);

  // Join/Leave project room
  useEffect(() => {
    if (projectId && socket && connected) {
      console.log('🔌 Joining project room:', projectId);
      socket.emit('join:project', projectId);

      return () => {
        console.log('🔌 Leaving project room:', projectId);
        socket.emit('leave:project', projectId);
      };
    }
  }, [projectId, socket, connected]);

  // Memoized selectors to prevent unnecessary re-renders
  const selectedProject = useAppSelector(state => state.projectReducer.project);
  const projectLoading = useAppSelector(state => state.projectReducer.projectLoading);
  const { setCurrentProject } = useProjectRole();

  // State to track translation loading
  const [translationsReady, setTranslationsReady] = useState(false);

  // Optimize document title updates
  useDocumentTitle(selectedProject?.name || t('projectView'));

  // Memoize URL params to prevent unnecessary state updates
  const urlParams = useMemo(
    () => ({
      tab: searchParams.get('tab') || tabItems[0].key,
      pinnedTab: searchParams.get('pinned_tab') || '',
      taskId: searchParams.get('task') || '',
    }),
    [searchParams]
  );

  const [activeTab, setActiveTab] = useState<string>(urlParams.tab);
  const [pinnedTab, setPinnedTab] = useState<string>(urlParams.pinnedTab);
  const [taskid, setTaskId] = useState<string>(urlParams.taskId);

  // Initialize timer state from backend when project view loads
  useTimerInitialization();

  // Update local state when URL params change
  useEffect(() => {
    setActiveTab(urlParams.tab);
    setPinnedTab(urlParams.pinnedTab);
    setTaskId(urlParams.taskId);
  }, [urlParams]);

  // Remove translation preloading since we're using simple load-as-you-go approach
  useEffect(() => {
    updateTabLabels();
    setTranslationsReady(true);
  }, [i18n.language]);

  // Update tab labels when language changes
  useEffect(() => {
    if (translationsReady) {
      updateTabLabels();
    }
  }, [t, translationsReady]);

  // Comprehensive cleanup function for when leaving project view entirely
  const resetAllProjectData = useCallback(() => {
    dispatch(setProjectId(null));
    dispatch(resetStatuses());
    dispatch(deselectAll());
    dispatch(resetTaskListData());
    dispatch(resetBoardData());
    dispatch(resetTaskManagement());
    dispatch(resetGrouping());
    dispatch(resetSelection());
    dispatch(resetEnhancedKanbanState());

    // Reset project insights
    dispatch(setInsightsProjectId(''));

    // Reset task drawer completely
    dispatch(resetTaskDrawer());
    
    // Reset project role to default (allows Reports/Invite on home page)
    setCurrentProject(null);
  }, [dispatch, setCurrentProject]);

  // Effect for handling component unmount (leaving project view entirely)
  useEffect(() => {
    // This cleanup only runs when the component unmounts
    return () => {
      resetAllProjectData();
    };
  }, [resetAllProjectData]);

  // Effect for handling route changes (when navigating away from project view)
  useEffect(() => {
    const currentPath = location.pathname;

    // If we're not on a project view path, clean up
    if (!currentPath.includes('/workspace/projects/') || currentPath === '/workspace/projects') {
      resetAllProjectData();
    }
  }, [location.pathname, resetAllProjectData]);

  // Optimized project data loading - reacts to projectId changes for instant switching
  useEffect(() => {
    console.log('🔄 [PROJECT-SWITCH] useEffect triggered. projectId:', projectId);
    
    if (!projectId) {
      console.log('⚠️ [PROJECT-SWITCH] No projectId, skipping load');
      return;
    }

    let cancelled = false;

    const loadProjectData = async () => {
      try {
        console.log('🔄 [PROJECT-SWITCH] Loading project:', projectId);
        
        // Clean up previous project data before loading new project
        dispatch(resetTaskListData());
        dispatch(resetBoardData());
        dispatch(resetTaskManagement());
        dispatch(resetEnhancedKanbanState());
        dispatch(deselectAll());
        dispatch(resetGrouping());
        dispatch(resetSelection());
        dispatch(resetTaskDrawer());

        if (cancelled) return;

        // Load new project data
        dispatch(setProjectId(projectId));

        // Load project and essential data in parallel
        const [projectResult] = await Promise.allSettled([
          dispatch(getProject(projectId)),
          dispatch(fetchStatuses(projectId)),
          dispatch(fetchLabels()),
        ]);

        if (cancelled) return;

        if (projectResult.status === 'fulfilled' && !projectResult.value.payload) {
          navigate('/workspace/projects');
          return;
        }

        // Set current project ownership for permissions
        if (projectResult.status === 'fulfilled' && projectResult.value.payload) {
          const project = projectResult.value.payload as any;
          
          console.log('📦 [PROJECT-SWITCH] Project Data Loaded:', {
            projectId,
            projectName: project.name,
            owner_id_raw: project.owner_id,
            owner_id_type: typeof project.owner_id,
          });
          
          // Try multiple ways to get owner_id
          let ownerId = null;
          
          if (typeof project.owner_id === 'string') {
            ownerId = project.owner_id;
          } else if (project.owner_id?._id) {
            ownerId = project.owner_id._id;
          } else if (project.owner_id?.toString) {
            ownerId = project.owner_id.toString();
          }
          
          console.log('🎯 [PROJECT-SWITCH] Extracted Owner ID:', ownerId);
          
          // Fetch user's role for this specific project using userId + projectId
          // This ensures role is always validated per project, preventing permission leakage
          try {
            const roleResponse = await projectsApiService.getUserRole(projectId);
            
            if (cancelled) return;
            
            if (roleResponse.done && roleResponse.body) {
              const { role } = roleResponse.body;
              console.log('✅ [PROJECT-SWITCH] User role fetched:', { projectId, role, ownerId });
              setCurrentProject(projectId, ownerId, role);
            } else {
              console.warn('⚠️ [PROJECT-SWITCH] Failed to fetch role, using owner check');
              // Fallback: just set project with owner ID, role will be determined by ownership
              setCurrentProject(projectId, ownerId);
            }
          } catch (roleError) {
            if (cancelled) return;
            console.error('❌ [PROJECT-SWITCH] Error fetching role:', roleError);
            // Fallback: set with owner ID only
            setCurrentProject(projectId, ownerId);
          }
        }

        console.log('✅ [PROJECT-SWITCH] Project loaded successfully:', projectId);
      } catch (error) {
        if (cancelled) return;
        console.error('❌ [PROJECT-SWITCH] Error loading project data:', error);
        navigate('/workspace/projects');
      }
    };

    loadProjectData();

    // Cleanup function to prevent race conditions when switching projects rapidly
    return () => {
      cancelled = true;
      console.log('🧹 [PROJECT-SWITCH] Cleanup for project:', projectId);
    };
  }, [projectId, dispatch, navigate, setCurrentProject]);

  // Effect for handling task drawer opening from URL params
  useEffect(() => {
    if (taskid && selectedProject) {
      dispatch(setSelectedTaskId(taskid));
      dispatch(setShowTaskDrawer(true));
    }
  }, [dispatch, taskid, selectedProject]);
  // Optimized pin tab function with better error handling
  const pinToDefaultTab = useCallback(
    async (itemKey: string) => {
      if (!itemKey || !projectId) return;

      try {
        const defaultView = itemKey === 'tasks-list' ? 'TASK_LIST' : 'BOARD';
        const res = await projectsApiService.updateDefaultTab({
          project_id: projectId,
          default_view: defaultView,
        });

        if (res.done) {
          setPinnedTab(itemKey);

          // Optimize tab items update
          tabItems.forEach(item => {
            item.isPinned = item.key === itemKey;
          });

          navigate(
            {
              pathname: `/workspace/projects/${projectId}`,
              search: new URLSearchParams({
                tab: activeTab,
                pinned_tab: itemKey,
              }).toString(),
            },
            { replace: true }
          ); // Use replace to avoid history pollution
        }
      } catch (error) {
        console.error('Error updating default tab:', error);
      }
    },
    [projectId, activeTab, navigate]
  );

  // Optimized tab change handler
  const handleTabChange = useCallback(
    (key: string) => {
      setActiveTab(key);
      dispatch(setProjectView(key === 'board' ? 'kanban' : 'list'));

      // Use replace for better performance and history management
      navigate(
        {
          pathname: location.pathname,
          search: new URLSearchParams({
            tab: key,
            pinned_tab: pinnedTab,
          }).toString(),
        },
        { replace: true }
      );
    },
    [dispatch, location.pathname, navigate, pinnedTab]
  );

  // Memoized tab menu items with enhanced styling
  const tabMenuItems = useMemo(() => {
    // Only render tabs when translations are ready
    if (!translationsReady) {
      return [];
    }

    const menuItems = tabItems.map(item => ({
      key: item.key,
      label: (
        <Flex align="center" gap={6} style={{ color: 'inherit' }}>
          <span style={{ fontWeight: 500, fontSize: '13px' }}>{item.label}</span>
          {(item.key === 'tasks-list' || item.key === 'board') && (
            <ConfigProvider wave={{ disabled: true }}>
              <Button
                className="borderless-icon-btn"
                size="small"
                type="text"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                  padding: '2px',
                  minWidth: 'auto',
                  height: 'auto',
                  lineHeight: 1,
                }}
                icon={
                  item.key === pinnedTab ? (
                    <PushpinFilled
                      style={{
                        fontSize: '12px',
                        color: 'currentColor',
                        transform: 'rotate(-45deg)',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  ) : (
                    <PushpinOutlined
                      style={{
                        fontSize: '12px',
                        color: 'currentColor',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  )
                }
                onClick={e => {
                  e.stopPropagation();
                  pinToDefaultTab(item.key);
                }}
                title={item.key === pinnedTab ? t('unpinTab') : t('pinTab')}
              />
            </ConfigProvider>
          )}
        </Flex>
      ),
      children: item.element,
    }));

    return menuItems;
  }, [pinnedTab, pinToDefaultTab, t, translationsReady]);

  // Optimized secondary components loading with better UX
  const [shouldLoadSecondaryComponents, setShouldLoadSecondaryComponents] = useState(false);

  useEffect(() => {
    if (selectedProject) {
      // Reduce delay and load secondary components after core data is ready
      const timer = setTimeout(() => {
        setShouldLoadSecondaryComponents(true);
      }, 500); // Reduced from 1000ms to 500ms

      return () => clearTimeout(timer);
    }
  }, [selectedProject]);

  // Optimized portal elements with better error boundaries
  const portalElements = useMemo(
    () => (
      <>
        {/* Critical component - load immediately without suspense */}
        {createPortal(<TaskDrawer />, document.body, 'task-drawer')}

        {/* Non-critical components - load after delay with suspense fallback */}
        {shouldLoadSecondaryComponents && (
          <Suspense fallback={<SuspenseFallback />}>
            {createPortal(<ProjectMemberDrawer />, document.body, 'project-member-drawer')}
            {createPortal(<PhaseDrawer />, document.body, 'phase-drawer')}
            {createPortal(<StatusDrawer />, document.body, 'status-drawer')}
            {createPortal(<DeleteStatusDrawer />, document.body, 'delete-status-drawer')}
          </Suspense>
        )}
      </>
    ),
    [shouldLoadSecondaryComponents]
  );

  // Show loading state while project is being fetched or translations are loading
  if (projectLoading || !selectedProject || !translationsReady) {
    return (
      <div style={{ marginBlockEnd: 12, minHeight: '80vh' }}>
        <SuspenseFallback />
      </div>
    );
  }

  return (
    <div style={{ marginBlockEnd: 12, minHeight: '80vh' }}>
      <ProjectViewHeader />

      <Tabs
        className="project-view-tabs"
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabMenuItems}
        destroyOnHidden={true}
        animated={{
          inkBar: true,
          tabPane: false,
        }}
        size="small"
      />

      {portalElements}
    </div>
  );
});

ProjectView.displayName = 'ProjectView';

export default ProjectView;

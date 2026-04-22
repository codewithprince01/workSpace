import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Button, ConfigProvider, Flex, PaginationProps, Table, TableColumnsType, Typography, Tag, Collapse } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { ExpandAltOutlined, RightOutlined } from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import ProjectCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-cell/project-cell';
import EstimatedVsActualCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/estimated-vs-actual-cell/estimated-vs-actual-cell';
import TasksProgressCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/tasks-progress-cell/tasks-progress-cell';
import LastActivityCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/last-activity-cell/last-activity-cell';
import ProjectStatusCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-status-cell/project-status-cell';
import ProjectClientCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-client-cell/project-client-cell';
import ProjectTeamCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-team-cell/project-team-cell';
import ProjectManagerCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-manager-cell/project-manager-cell';
import ProjectDatesCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-dates-cell/project-dates-cell';
import ProjectHealthCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-health-cell/project-health-cell';
import ProjectCategoryCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-category-cell/project-category-cell';
import ProjectDaysLeftAndOverdueCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-days-left-and-overdue-cell/project-days-left-and-overdue-cell';
import ProjectUpdateCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-update-cell/project-update-cell';
import {
  fetchProjectData,
  resetProjectReports,
  setField,
  setIndex,
  setOrder,
  setPageSize,
  toggleProjectReportsDrawer,
} from '@/features/reporting/projectReports/project-reports-slice';
import { colors } from '@/styles/colors';
import CustomTableTitle from '@/components/CustomTableTitle';
import { IRPTProject } from '@/types/reporting/reporting.types';
import ProjectReportsDrawer from '@/features/reporting/projectReports/projectReportsDrawer/ProjectReportsDrawer';
import { PAGE_SIZE_OPTIONS } from '@/shared/constants';
import './projects-reports-table.css';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { themeWiseColor } from '@/utils/themeWiseColor';

const ProjectsReportsTable = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects');

  const [selectedProject, setSelectedProject] = useState<IRPTProject | null>(null);
  const { projectStatuses, loading: projectStatusesLoading } = useAppSelector(
    state => state.projectStatusesReducer
  );

  const {
    projectList,
    isLoading,
    total,
    index,
    pageSize,
    order,
    field,
    searchQuery,
    selectedProjectStatuses,
    selectedProjectHealths,
    selectedProjectCategories,
    selectedProjectManagers,
    selectedProjectTeams,
    archived,
    viewMode,
  } = useAppSelector(state => state.projectReportsReducer);

  const columnsVisibility = useAppSelector(state => state.projectReportsTableColumnsReducer);

  const handleDrawerOpen = useCallback(
    (record: IRPTProject) => {
      setSelectedProject(record);
      dispatch(toggleProjectReportsDrawer());
    },
    [dispatch]
  );

  const columns: TableColumnsType<IRPTProject> = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: <CustomTableTitle title={t('projectColumn')} />,
        width: 300,
        sorter: true,
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        fixed: 'left' as const,
        onCell: record => ({
          onClick: () => handleDrawerOpen(record as IRPTProject),
        }),
        render: (_, record: { id: string; name: string; color_code: string }) => (
          <Flex gap={16} align="center" justify="space-between">
            <ProjectCell
              projectId={record.id}
              project={record.name}
              projectColor={record.color_code}
            />
            <Button
              className="hidden group-hover:flex"
              type="text"
              style={{
                backgroundColor: colors.transparent,
                padding: 0,
                height: 22,
                alignItems: 'center',
                gap: 8,
              }}
            >
              {t('openButton')} <ExpandAltOutlined />
            </Button>
          </Flex>
        ),
      },
      {
        key: 'estimatedVsActual',
        title: <CustomTableTitle title={t('estimatedVsActualColumn')} />,
        render: record => (
          <EstimatedVsActualCell
            actualTime={record.actual_time || 0}
            actualTimeString={record.actual_time_string}
            estimatedTime={record.estimated_time * 60 || 0}
            estimatedTimeString={record.estimated_time_string}
          />
        ),
        width: 230,
      },
      {
        key: 'tasksProgress',
        title: <CustomTableTitle title={t('tasksProgressColumn')} />,
        render: record => <TasksProgressCell tasksStat={record.tasks_stat} />,
        width: 200,
      },
      {
        key: 'lastActivity',
        title: <CustomTableTitle title={t('lastActivityColumn')} />,
        render: record => (
          <LastActivityCell activity={record.last_activity?.last_activity_string} />
        ),
        width: 200,
      },
      {
        key: 'status',
        dataIndex: 'status_id',
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        title: <CustomTableTitle title={t('statusColumn')} />,
        render: (_, record: IRPTProject) => (
          <ProjectStatusCell currentStatus={record.status_id} projectId={record.id} />
        ),
        width: 200,
        sorter: true,
      },
      {
        key: 'dates',
        title: <CustomTableTitle title={t('datesColumn')} />,
        render: record => (
          <ProjectDatesCell
            projectId={record.id}
            startDate={record.start_date}
            endDate={record.end_date}
          />
        ),
        width: 275,
      },
      {
        key: 'daysLeft',
        title: <CustomTableTitle title={t('daysLeftColumn')} />,
        render: record => (
          <ProjectDaysLeftAndOverdueCell
            daysLeft={record.days_left}
            isOverdue={record.is_overdue}
            isToday={record.is_today}
          />
        ),
        width: 200,
      },
      {
        key: 'projectHealth',
        dataIndex: 'project_health',
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        title: <CustomTableTitle title={t('projectHealthColumn')} />,
        sorter: true,
        render: (_, record: IRPTProject) => (
          <ProjectHealthCell
            value={record.project_health}
            label={record.health_name}
            color={record.health_color}
            projectId={record.id}
          />
        ),
        width: 200,
      },
      {
        key: 'category',
        title: <CustomTableTitle title={t('categoryColumn')} />,
        render: (_, record: IRPTProject) => (
          <ProjectCategoryCell
            projectId={record.id}
            id={record.category_id || ''}
            name={record.category_name || ''}
            color_code={record.category_color || ''}
          />
        ),
        width: 200,
      },
      {
        key: 'projectUpdate',
        title: <CustomTableTitle title={t('projectUpdateColumn')} />,
        render: (_, record: IRPTProject) =>
          record.comment ? <ProjectUpdateCell updates={record.comment} /> : '-',
        width: 200,
      },
      {
        key: 'client',
        dataIndex: 'client',
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        title: <CustomTableTitle title={t('clientColumn')} />,
        render: (_, record: IRPTProject) =>
          record?.client ? <ProjectClientCell client={record.client} /> : '-',
        sorter: true,
        width: 200,
      },
      {
        key: 'team',
        dataIndex: 'team_name',
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        title: <CustomTableTitle title={t('teamColumn')} />,
        render: (_, record: IRPTProject) =>
          record.team_name ? <ProjectTeamCell team={record.team_name} /> : '-',
        sorter: true,
        width: 200,
      },
      {
        key: 'projectManager',
        title: <CustomTableTitle title={t('projectManagerColumn')} />,
        render: (_, record: IRPTProject) =>
          record.project_manager ? <ProjectManagerCell manager={record.project_manager} /> : '-',
        width: 200,
      },
    ],
    [t, order, handleDrawerOpen]
  );

  const visibleColumns = useMemo(
    () => columns.filter(col => columnsVisibility[col.key as string]),
    [columns, columnsVisibility]
  );

  const handleTableChange = useCallback(
    (pagination: PaginationProps, filters: any, sorter: any) => {
      if (sorter.order) dispatch(setOrder(sorter.order));
      if (sorter.field) dispatch(setField(sorter.field));
      dispatch(setIndex(pagination.current));
      dispatch(setPageSize(pagination.pageSize));
    },
    [dispatch]
  );

  useEffect(() => {
    if (!isLoading) dispatch(fetchProjectData());
    if (projectStatuses.length === 0 && !projectStatusesLoading) dispatch(fetchProjectStatuses());
  }, [
    dispatch,
    searchQuery,
    selectedProjectStatuses,
    selectedProjectHealths,
    selectedProjectCategories,
    selectedProjectManagers,
    selectedProjectTeams,
    archived,
    index,
    pageSize,
    order,
    field,
  ]);

  useEffect(() => {
    return () => {
      dispatch(resetProjectReports());
    };
  }, [dispatch]);

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const tableRowProps = useMemo(
    () => ({
      style: { height: 56, cursor: 'pointer' },
      className: `group ${themeMode === 'dark' ? 'even:bg-[#4e4e4e10]' : 'even:bg-[#00000005]'}`,
    }),
    [themeMode]
  );

  const tableConfig = useMemo(
    () => ({
      theme: {
        components: {
          Table: {
            cellPaddingBlock: 12,
            cellPaddingInline: 10,
          },
        },
      },
    }),
    []
  );

  const paginationConfig = useMemo(
    () => ({
      showSizeChanger: true,
      defaultPageSize: 10,
      total: total,
      current: index,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
    }),
    [total, index]
  );

  const scrollConfig = useMemo(() => ({ x: 'max-content' }), []);
  const getRowKey = useCallback((record: IRPTProject) => record.id, []);
  const getRowProps = useCallback(() => tableRowProps, [tableRowProps]);

  // ── Grouped view: group projects by team name ───────────────────────────────
  const groupedByTeam = useMemo(() => {
    const map: Record<string, IRPTProject[]> = {};
    projectList.forEach(p => {
      const key = p.team_name || 'No Team';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [projectList]);

  const collapseItems = useMemo(() => {
    return Object.entries(groupedByTeam).map(([teamName, projects]) => ({
      key: teamName,
      label: (
        <Flex align="center" gap={12}>
          <Typography.Text style={{ color: themeWiseColor('#262626', '#fff', themeMode), fontSize: '14px', fontWeight: 600 }}>{teamName}</Typography.Text>
          <span style={{ color: themeWiseColor('rgba(0, 0, 0, 0.45)', 'rgba(255, 255, 255, 0.45)', themeMode), fontSize: '12px' }}>•</span>
          <Typography.Text style={{ color: themeWiseColor('rgba(0, 0, 0, 0.45)', 'rgba(255, 255, 255, 0.45)', themeMode), fontSize: '12px' }}>
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </Typography.Text>
        </Flex>
      ),
      children: (
        <ConfigProvider {...tableConfig}>
          <Table
            columns={visibleColumns}
            dataSource={projects}
            pagination={false}
            scroll={scrollConfig}
            loading={false}
            rowKey={getRowKey}
            onRow={getRowProps}
            size="small"
          />
        </ConfigProvider>
      ),
    }));
  }, [groupedByTeam, visibleColumns, scrollConfig, getRowKey, getRowProps, tableConfig, themeMode]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {viewMode === 'grouped' ? (
        <Flex vertical gap={0}>
          {isLoading ? (
            <ConfigProvider {...tableConfig}>
              <Table columns={visibleColumns} dataSource={[]} loading pagination={false} />
            </ConfigProvider>
          ) : (
            <ConfigProvider
                theme={{
                    components: {
                        Collapse: {
                            headerBg: themeWiseColor('rgba(0, 0, 0, 0.02)', 'rgba(255, 255, 255, 0.05)', themeMode),
                            contentBg: 'transparent',
                            headerPadding: '12px 16px',
                            colorBorder: themeWiseColor('#d9d9d9', '#333', themeMode),
                            colorTextHeading: themeWiseColor('#262626', '#fff', themeMode)
                        }
                    }
                }}
            >
                <Collapse
                defaultActiveKey={Object.keys(groupedByTeam)}
                expandIcon={({ isActive }) => (
                    <RightOutlined rotate={isActive ? 90 : 0} style={{ fontSize: 10, color: '#1890ff' }} />
                )}
                style={{ 
                    background: 'transparent', 
                    border: `1px solid ${themeWiseColor('#d9d9d9', '#333', themeMode)}`, 
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}
                items={collapseItems}
                />
            </ConfigProvider>
          )}
          {/* Pagination still shown below grouped view for all records */}
          <Flex justify="flex-end" style={{ marginTop: 16 }}>
            <ConfigProvider>
              <Table
                columns={[]}
                dataSource={[]}
                pagination={paginationConfig}
                onChange={handleTableChange}
                style={{ display: 'none' }}
              />
            </ConfigProvider>
          </Flex>
        </Flex>
      ) : (
        <ConfigProvider {...tableConfig}>
          <Table
            columns={visibleColumns}
            dataSource={projectList}
            pagination={paginationConfig}
            scroll={scrollConfig}
            loading={isLoading}
            onChange={handleTableChange}
            rowKey={getRowKey}
            onRow={getRowProps}
          />
        </ConfigProvider>
      )}
      {createPortal(<ProjectReportsDrawer selectedProject={selectedProject} />, document.body)}
    </>
  );
};

export default memo(ProjectsReportsTable);

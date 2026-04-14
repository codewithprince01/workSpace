import React, { ReactNode, lazy } from 'react';
import {
  AppstoreOutlined,
  BarChartOutlined,
  CalendarOutlined,
  DashboardOutlined,
  FileTextOutlined,
  ProjectOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@/shared/antd-imports';

const OverviewReports = lazy(() => import('@/pages/reporting/overview-reports/overview-reports'));
const ProjectsReports = lazy(() => import('@/pages/reporting/projects-reports/projects-reports'));
const MembersReports = lazy(() => import('@/pages/reporting/members-reports/members-reports'));
const TasksReports = lazy(() => import('@/pages/reporting/tasks-reports/tasks-reports'));
const OverviewTimeReports = lazy(() => import('@/pages/reporting/timeReports/overview-time-reports'));
const ProjectsTimeReports = lazy(() => import('@/pages/reporting/timeReports/projects-time-reports'));
const MembersTimeReports = lazy(() => import('@/pages/reporting/timeReports/members-time-reports'));
const EstimatedVsActualTimeReports = lazy(() => import('@/pages/reporting/timeReports/estimated-vs-actual-time-reports'));
const TimeLogsReports = lazy(() => import('@/pages/reporting/timeReports/time-logs-reports'));

// Type definition for a menu item
export type ReportingMenuItems = {
  key: string;
  name: string;
  endpoint: string;
  element: ReactNode;
  icon?: ReactNode;
  children?: ReportingMenuItems[];
};

// Reporting paths and related elements with nested structure
export const reportingsItems: ReportingMenuItems[] = [
  {
    key: 'overview',
    name: 'overview',
    endpoint: 'overview',
    element: React.createElement(OverviewReports),
    icon: React.createElement(DashboardOutlined),
  },
  {
    key: 'projects',
    name: 'projects',
    endpoint: 'projects',
    element: React.createElement(ProjectsReports),
    icon: React.createElement(AppstoreOutlined),
  },
  {
    key: 'members',
    name: 'members',
    endpoint: 'members',
    element: React.createElement(MembersReports),
    icon: React.createElement(TeamOutlined),
  },
  {
    key: 'tasks',
    name: 'tasks',
    endpoint: 'tasks',
    element: React.createElement(TasksReports),
    icon: React.createElement(UnorderedListOutlined),
  },
  {
    key: 'time-sheet',
    name: 'timeReports',
    endpoint: 'time-sheets',
    element: null,
    children: [
      {
        key: 'time-sheet-overview',
        name: 'timesheet',
        endpoint: 'time-sheet-overview',
        element: React.createElement(OverviewTimeReports),
        icon: React.createElement(CalendarOutlined),
      },
      {
        key: 'time-sheet-projects',
        name: 'projects',
        endpoint: 'time-sheet-projects',
        element: React.createElement(ProjectsTimeReports),
        icon: React.createElement(ProjectOutlined),
      },
      {
        key: 'time-sheet-members',
        name: 'members',
        endpoint: 'time-sheet-members',
        element: React.createElement(MembersTimeReports),
        icon: React.createElement(TeamOutlined),
      },
      {
        key: 'time-sheet-estimate-vs-actual',
        name: 'estimateVsActual',
        endpoint: 'time-sheet-estimate-vs-actual',
        element: React.createElement(EstimatedVsActualTimeReports),
        icon: React.createElement(BarChartOutlined),
      },
      {
        key: 'time-sheet-logs',
        name: 'timeLogs',
        endpoint: 'time-sheet-logs',
        element: React.createElement(TimeLogsReports),
        icon: React.createElement(FileTextOutlined),
      },
    ],
  },
];

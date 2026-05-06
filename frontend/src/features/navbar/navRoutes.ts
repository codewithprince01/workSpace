export type NavRoutesType = {
  name: string;
  path: string;
  adminOnly?: boolean;
  freePlanFeature?: boolean;
  requiresReportsAccess?: boolean;
  superAdminOnly?: boolean; // Only visible to super admins
};

export const navRoutes: NavRoutesType[] = [
  {
    name: 'home',
    path: '/workspace/home',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'projects',
    path: '/workspace/projects',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'calendar',
    path: '/workspace/calendar',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'todo',
    path: '/workspace/todo',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'reporting',
    path: '/workspace/reporting/overview',
    adminOnly: false,
    freePlanFeature: false,
    requiresReportsAccess: true,
  },
  {
    name: 'Global Projects',
    path: '/workspace/global-projects',
    adminOnly: false,
    freePlanFeature: true,
    superAdminOnly: true,
  },
];

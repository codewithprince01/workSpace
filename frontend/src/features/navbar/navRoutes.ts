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
    path: '/worklenz/home',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'projects',
    path: '/worklenz/projects',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'calendar',
    path: '/worklenz/calendar',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'todo',
    path: '/worklenz/todo',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'reporting',
    path: '/worklenz/reporting/overview',
    adminOnly: false,
    freePlanFeature: false,
    requiresReportsAccess: true,
  },
  {
    name: 'Global Projects',
    path: '/worklenz/global-projects',
    adminOnly: false,
    freePlanFeature: true,
    superAdminOnly: true,
  },
];

export type NavRoutesType = {
  name: string;
  path: string;
  adminOnly?: boolean;
  freePlanFeature?: boolean;
  requiresReportsAccess?: boolean; // Flag for routes that require reports permission
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
  // {
  //   name: 'schedule',
  //   path: '/worklenz/schedule',
  //   adminOnly: true,
  //   freePlanFeature: false,
  // },
  {
    name: 'reporting',
    path: '/worklenz/reporting/overview',
    adminOnly: false,
    freePlanFeature: false,
    requiresReportsAccess: true,  // Only Owner/Admin can access
  },
];

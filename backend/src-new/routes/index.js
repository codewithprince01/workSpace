const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const projectsRoutes = require('./projects.routes');
const tasksRoutes = require('./tasks.routes');
const teamsRoutes = require('./teams.routes');
const usersRoutes = require('./users.routes');
const surveysRoutes = require('./surveys.routes');
const settingsRoutes = require('./settings.routes');
const projectTemplatesRoutes = require('./project-templates.routes');
const timeLogsRoutes = require('./time-logs.routes');
const subTasksRoutes = require('./sub-tasks.routes');
const taskDependenciesRoutes = require('./task-dependencies.routes');
router.use('/time-logs', timeLogsRoutes);
const taskTimeLogsRoutes = require('./task-time-logs.routes');
router.use('/task-time-log', taskTimeLogsRoutes);
const activityLogsRoutes = require('./activity-logs.routes');
router.use('/activity-logs', activityLogsRoutes);
const taskCommentsRoutes = require('./task-comments.routes');
router.use('/task-comments', taskCommentsRoutes);
const attachmentsRoutes = require('./attachments.routes');
router.use('/attachments', attachmentsRoutes);
const logsRoutes = require('./logs.routes');
router.use('/logs', logsRoutes);
const projectStatusesRoutes = require('./project-statuses.routes');
const projectHealthsRoutes = require('./project-healths.routes');
const projectCategoriesRoutes = require('./project-categories.routes');
const notificationsRoutes = require('./notifications.routes');
const clientsRoutes = require('./clients.routes');
const labelsRoutes = require('./labels.routes');
const taskPrioritiesRoutes = require('./task-priorities.routes');
const teamMembersRoutes = require('./team-members.routes');
const homeRoutes = require('./home.routes');
const adminCenterRoutes = require('./admin-center.routes');
const jobTitlesRoutes = require('./job-titles.routes');
const projectMembersRoutes = require('./project-members.routes');
const projectInsightsRoutes = require('./project-insights.routes');
const projectManagersRoutes = require('./project-managers.routes');
const projectCommentsRoutes = require('./project-comments.routes');
const reportingRoutes = require('./reporting.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/projects', projectsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/teams', teamsRoutes);
router.use('/users', usersRoutes);
router.use('/surveys', surveysRoutes);
router.use('/settings', settingsRoutes);
router.use('/project-templates', projectTemplatesRoutes);
router.use('/reporting', reportingRoutes);
router.use('/sub-tasks', subTasksRoutes);
router.use('/task-dependencies', taskDependenciesRoutes);

// Mount stub routes
router.use('/statuses', projectStatusesRoutes);
router.use('/project-statuses', projectStatusesRoutes);
router.use('/project-healths', projectHealthsRoutes);
router.use('/project-categories', projectCategoriesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/clients', clientsRoutes);
router.use('/labels', labelsRoutes);
router.use('/task-priorities', taskPrioritiesRoutes);
router.use('/team-members', teamMembersRoutes);
router.use('/home', homeRoutes);
router.use('/admin-center', adminCenterRoutes);
router.use('/job-titles', jobTitlesRoutes);
router.use('/project-members', projectMembersRoutes);
router.use('/project-insights', projectInsightsRoutes);
router.use('/project-managers', projectManagersRoutes);
router.use('/project-comments', projectCommentsRoutes);

const taskPhasesRoutes = require('./task-phases.routes');
router.use('/task-phases', taskPhasesRoutes);

const v1Routes = require('./v1.routes');
router.use('/v1', v1Routes);

// Debug routes (only in development)
if (process.env.NODE_ENV !== 'production') {
  const debugRoutes = require('./debug.routes');
  router.use('/debug', debugRoutes);
}

// Legacy routes support (for frontend compatibility)
// Mount at root so paths like /login, /signup work directly under /secure
router.use('/', authRoutes);

module.exports = router;

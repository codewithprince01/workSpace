const express = require('express');
const router = express.Router();
const { reporting } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');
const { requireReportsAccess, checkProjectRole } = require('../middlewares/project-role.middleware');

router.use(protect);

// Reporting routes - require owner or admin role (checked per-request)
router.get('/info', reporting.getInfo);
router.get('/overview/statistics', reporting.getOverviewStatistics);
router.get('/overview/teams', reporting.getOverviewTeams);
router.post('/projects', reporting.getProjectsReports);
router.get('/projects/filters', reporting.getProjectsReportingFilters);
router.get('/tasks/filters', reporting.getTasksReportingFilters);
router.post('/tasks', reporting.getTasksReports);
router.post('/members', reporting.getMembersReports);
router.post('/allocation', reporting.getAllocationData);
router.post('/allocation/categories', reporting.getAllocationCategories);
router.post('/allocation/projects', reporting.getAllocationProjects);

router.get('/overview/project/info/:id', reporting.getProjectOverviewInfo);
router.get('/overview/project/members/:id', reporting.getProjectOverviewMembers);
router.get('/overview/project/tasks/:id', reporting.getProjectOverviewTasks);

router.post('/time-reports/projects', reporting.getTimeReportsProjects);
router.post('/time-reports/members', reporting.getTimeReportsMembers);
router.post('/time-reports/estimated-vs-actual', reporting.getEstimatedVsActual);

module.exports = router;

const express = require('express');
const router = express.Router();
const controller = require('../controllers/project-insights.controller');
const { protect } = require('../middlewares/auth.middleware');
const { commonValidators } = require('../middlewares/validation.middleware');

router.use(protect);

router.get('/:id/insights', commonValidators.mongoId, controller.getProjectInsights);
router.get('/:id', commonValidators.mongoId, controller.getProjectOverviewData);
router.get('/last-updated/:id', commonValidators.mongoId, controller.getLastUpdatedTasks);
router.get('/logs/:id', commonValidators.mongoId, controller.getProjectLogs);
router.get('/status-overview/:id', commonValidators.mongoId, controller.getTaskStatusCounts);
router.get('/priority-overview/:id', commonValidators.mongoId, controller.getPriorityOverview);
router.get('/overdue-tasks/:id', commonValidators.mongoId, controller.getOverdueTasks);
router.get('/early-tasks/:id', commonValidators.mongoId, controller.getTasksCompletedEarly);
router.get('/late-tasks/:id', commonValidators.mongoId, controller.getTasksCompletedLate);
router.get('/members/stats/:id', commonValidators.mongoId, controller.getMemberInsightAStats);
router.post('/members/tasks', controller.getMemberTasks);
router.get('/deadline/:id', commonValidators.mongoId, controller.getProjectDeadlineStats);
router.get('/overlogged-tasks/:id', commonValidators.mongoId, controller.getOverloggedTasks);

module.exports = router;

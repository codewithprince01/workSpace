const express = require('express');
const router = express.Router();
const { tasks } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');
const { taskValidators, commonValidators } = require('../middlewares/validation.middleware');

router.use(protect);

router.route('/')
  .get(tasks.getAll)
  .post(taskValidators.create, tasks.create);

router.put('/bulk', tasks.bulkUpdate);
router.put('/bulk/:action', tasks.bulkUpdate);
router.get('/info', tasks.getTaskInfo);
router.get('/search', tasks.search);
router.get('/dependency-status', tasks.getTaskDependencyStatus);
router.get('/progress-status/:projectId', commonValidators.mongoIdParam('projectId'), tasks.getProgressStatus);
router.get('/assignees/:projectId', commonValidators.mongoIdParam('projectId'), tasks.getAssignees);
router.get('/subscribers/:id', commonValidators.mongoId, tasks.getSubscribers);
router.get('/trash', tasks.getTrash);
router.put('/trash/restore', tasks.restoreFromTrash);
router.delete('/trash', tasks.permanentlyDeleteFromTrash);
router.get('/list/v3/:projectId', commonValidators.mongoIdParam('projectId'), tasks.getTaskListV3);
router.get('/list/v2/:projectId', commonValidators.mongoIdParam('projectId'), tasks.getTaskListV3);
router.get('/list/columns/:projectId', commonValidators.mongoIdParam('projectId'), tasks.getTaskListColumns);
router.put('/list/columns/:projectId', commonValidators.mongoIdParam('projectId'), tasks.updateColumnVisibility);

router.route('/:id')
  .get(commonValidators.mongoId, tasks.getById)
  .put(taskValidators.update, tasks.update)
  .delete(commonValidators.mongoId, tasks.delete);

router.put('/:id/group', commonValidators.mongoId, tasks.updateTaskGroup);
router.post('/:id/comments', commonValidators.mongoId, tasks.addComment);

module.exports = router;

const express = require('express');
const router = express.Router();
const { taskDependencies } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');
const { commonValidators } = require('../middlewares/validation.middleware');

router.use(protect);

// Task dependencies routes
router.get('/:taskId', commonValidators.mongoIdParam('taskId'), taskDependencies.getTaskDependencies);

router.post('/', taskDependencies.createTaskDependency);

router.delete('/:id', commonValidators.mongoIdParam('id'), taskDependencies.deleteTaskDependency);

module.exports = router;

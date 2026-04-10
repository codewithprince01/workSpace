const express = require('express');
const router = express.Router();
const { tasks } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');
const { commonValidators } = require('../middlewares/validation.middleware');

router.use(protect);

// Redirect sub-task calls to tasks controller
router.get('/:parentTaskId', commonValidators.mongoIdParam('parentTaskId'), async (req, res, next) => {
    req.query.parent_task_id = req.params.parentTaskId;
    return tasks.getAll(req, res, next);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const controller = require('../controllers/custom-columns.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

// Custom Columns Routes
router.get('/custom-columns/project/:projectId/columns', controller.getProjectColumns);
router.post('/custom-columns', controller.create);
router.put('/custom-columns/:id', controller.update);
router.delete('/custom-columns/:id', controller.delete);
router.put('/custom-columns/project/:projectId/columns', controller.updateVisibility);

// Task specific route for custom column values
router.put('/tasks/:taskId/custom-column', controller.updateTaskValue);

module.exports = router;

const express = require('express');
const router = express.Router();
const projectMembersController = require('../controllers/project-members.controller');
const { protect } = require('../middlewares/auth.middleware');
const { checkProjectRole, requireProjectAdmin } = require('../middlewares/project-role.middleware');
const { commonValidators } = require('../middlewares/validation.middleware');

router.use(protect);

// Admin-only: Creating/inviting members requires admin permission
router.post('/', checkProjectRole, requireProjectAdmin, projectMembersController.create);
router.post('/invite', checkProjectRole, requireProjectAdmin, projectMembersController.invite);

// Read-only: Any member can view project members
router.get('/:projectId', commonValidators.mongoIdParam('projectId'), checkProjectRole, projectMembersController.getByProjectId);

// Admin-only: Removing members requires admin permission
router.delete('/:id', commonValidators.mongoId, requireProjectAdmin, projectMembersController.delete);

module.exports = router;

const express = require('express');
const router = express.Router();
const { projects } = require('../controllers');
const projectsRole = require('../controllers/projects-role.controller');
const { protect } = require('../middlewares/auth.middleware');
const { checkProjectRole, requireProjectOwner, requireProjectAdmin } = require('../middlewares/project-role.middleware');
const { projectValidators, commonValidators } = require('../middlewares/validation.middleware');

router.get('/invite/:token', projects.getInviteByToken);  // public — fetch invite details
router.post('/invite/accept', protect, projects.acceptInvite); // must be logged in to accept

router.use(protect); // All routes below require authentication

router.route('/')
  .get(projects.getAll)
  .post(projectValidators.create, projects.create);

router.get('/grouped', projects.getGrouped);

router.put('/update-pinned-view', projects.updatePinnedView);

// Any project member can access these
router.get('/:id/role', commonValidators.mongoId, checkProjectRole, projectsRole.getUserRole);
router.get('/overview/:id', commonValidators.mongoId, checkProjectRole, projects.getOverview);
router.get('/overview-members/:id', commonValidators.mongoId, checkProjectRole, projects.getOverviewMembers);
router.get('/members/:id', commonValidators.mongoId, checkProjectRole, projects.getMembers);

// Admin-only: Inviting members
// Admin-only: Inviting members
router.post('/:id/members', commonValidators.mongoId, checkProjectRole, requireProjectAdmin, projects.addMember);
router.post('/:id/invite', commonValidators.mongoId, checkProjectRole, requireProjectAdmin, projects.inviteMember);

// Any member can favorite/toggle personal settings
router.put('/favorite/:id', commonValidators.mongoId, checkProjectRole, projects.toggleFavorite);

// Owner-only: Critical admin actions
router.get('/archive/:id', commonValidators.mongoId, checkProjectRole, requireProjectOwner, projects.archive);
router.get('/archive-all/:id', commonValidators.mongoId, checkProjectRole, requireProjectOwner, projects.archiveAll);

router.route('/:id')
  .get(commonValidators.mongoId, checkProjectRole, projects.getById)
  // Any member can view/edit project details
  .put(projectValidators.update, checkProjectRole, projects.update)
  .patch(projectValidators.update, checkProjectRole, projects.update)
  // Only owner can delete
  .delete(commonValidators.mongoId, checkProjectRole, requireProjectOwner, projects.delete);

module.exports = router;

const express = require('express');
const router = express.Router();
const teamsController = require('../controllers/teams.controller'); // Direct import
const { protect } = require('../middlewares/auth.middleware');
const { commonValidators } = require('../middlewares/validation.middleware');

console.log('✅ Teams routes module loading...');

router.use(protect);

// GET /api/teams
router.get('/', (req, res, next) => {
  console.log('➡️ GET /api/teams hit');
  teamsController.getAll(req, res, next);
});

// POST /api/teams
router.post('/', teamsController.create);

// PUT /api/teams/activate
router.put('/activate', teamsController.activate);

// GET /api/teams/invites
router.get('/invites', teamsController.getInvites);

// PUT /api/teams - accept invitation
router.put('/', teamsController.acceptInvitation);

// PUT /api/teams/:id/members/:userId
router.put('/:id/members/:userId', teamsController.updateMemberRole);

// POST /api/teams/:id/members
router.post('/:id/members', commonValidators.mongoId, teamsController.addMember);

// DELETE /api/teams/:id/members/:userId
router.delete('/:id/members/:userId', teamsController.removeMember);

// GET /api/teams/:id
router.get('/:id', commonValidators.mongoId, teamsController.getById);

// PUT /api/teams/:id
router.put('/:id', commonValidators.mongoId, teamsController.update);

console.log('✅ Teams routes configured');

module.exports = router;


const express = require('express');
const router = express.Router();
const teamsController = require('../controllers/teams.controller');
const authController = require('../controllers/auth.controller');
const { protect, adminOnly } = require('../middlewares/auth.middleware');

router.use(protect);

// GET /api/admin-center/organization/teams
router.get('/organization/teams', async (req, res, next) => {
  // Reuse existing teams controller logic, but maybe wrapper if needed
  // For now, simple reuse:
  teamsController.getAll(req, res, next);
});

// GET /api/admin-center/organization/members
router.get('/organization/members', async (req, res) => {
  try {
    const { TeamMember } = require('../models');
    
    // Determine team ID
    // 1. From Query
    let teamId = req.query.team_id;
    
    // 2. From User (if implemented) or fallback to first active team
    if (!teamId) {
       const member = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
       if (member) teamId = member.team_id;
    }
    
    if (!teamId) {
        return res.json({ done: true, body: { data: [], total: 0 } });
    }

    const members = await TeamMember.find({ 
      team_id: teamId,
      is_active: true
    }).populate('user_id', 'name email avatar_url');
    
    res.json({
      done: true,
      body: {
        data: members.map(m => ({
            id: m.user_id._id,
            name: m.user_id.name,
            email: m.user_id.email,
            role: m.role,
            status: m.is_active ? 'Active' : 'Inactive',
            joined_at: m.created_at
        })),
        total: members.length
      }
    });
  } catch (error) {
    console.error('Admin members error:', error);
    res.json({ done: true, body: { data: [], total: 0 } });
  }
});

// GET /api/admin-center/billing/subscription
router.get('/billing/subscription', (req, res) => {
  res.json({
    done: true,
    body: {
      plan: 'free',
      status: 'active'
    }
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Apply protection to all routes
router.use(protect);

// GET /api/project-categories - Get all project categories
router.get('/', async (req, res) => {
  try {
    const { ProjectCategory, TeamMember, Team } = require('../models');
    
    // Find user's team
    let teamId = req.query.team_id;
    if (!teamId) {
       const member = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
       teamId = member?.team_id;
    }

    if (!teamId) {
        return res.json({ done: true, body: [] });
    }

    const categories = await ProjectCategory.find({ team_id: teamId, is_archived: false });
    
    res.json({
      done: true,
      body: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch project categories' });
  }
});

// GET /api/project-categories/org-categories - Get organization categories
router.get('/org-categories', async (req, res) => {
  try {
    const { ProjectCategory, TeamMember } = require('../models');
    
    // Find user's team(s)
    const members = await TeamMember.find({ user_id: req.user._id, is_active: true });
    const teamIds = members.map(m => m.team_id);

    if (teamIds.length === 0) {
        return res.json({ done: true, body: [] });
    }

    const categories = await ProjectCategory.find({ team_id: { $in: teamIds }, is_archived: false });
    
    res.json({
      done: true,
      body: categories
    });
  } catch (error) {
    console.error('Get org categories error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch categories' });
  }
});

// POST /api/project-categories - Create category
router.post('/', async (req, res) => {
  try {
    const { name, color_code, team_id } = req.body;
    const { ProjectCategory, TeamMember, Team } = require('../models');

    let targetTeamId = team_id;
    if (!targetTeamId) {
        // Resolve team
        const member = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
        targetTeamId = member?.team_id;
        
        if (!targetTeamId) {
             const newTeam = await Team.create({ name: `${req.user.name}'s Team`, owner_id: req.user._id });
             await TeamMember.create({ team_id: newTeam._id, user_id: req.user._id, role: 'owner' });
             targetTeamId = newTeam._id;
        }
    }

    const category = await ProjectCategory.create({
        name,
        color_code,
        team_id: targetTeamId
    });

    res.json({
        done: true,
        body: category
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ done: false, message: 'Failed to create category' });
  }
});

module.exports = router;

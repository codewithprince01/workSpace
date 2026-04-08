const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Apply protection to all routes
router.use(protect);

// GET /api/clients - Get all clients
router.get('/', async (req, res) => {
  try {
    const { Client, TeamMember } = require('../models');
    
    // Find user's team
    let teamId = req.query.team_id;
    if (!teamId) {
       const member = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
       teamId = member?.team_id;
    }

    if (!teamId) {
        return res.json({ done: true, body: { data: [], total: 0 } });
    }

    const clients = await Client.find({ team_id: teamId, is_archived: false });
    
    res.json({
      done: true,
      body: {
        data: clients,
        total: clients.length
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch clients' });
  }
});

// POST /api/clients - Create client
router.post('/', async (req, res) => {
  try {
    const { name, email, team_id } = req.body;
    const { Client, TeamMember, Team } = require('../models');

    let targetTeamId = team_id;
    if (!targetTeamId) {
        const member = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
        targetTeamId = member?.team_id;
        
        if (!targetTeamId) {
             const newTeam = await Team.create({ name: `${req.user.name}'s Team`, owner_id: req.user._id });
             await TeamMember.create({ team_id: newTeam._id, user_id: req.user._id, role: 'owner' });
             targetTeamId = newTeam._id;
        }
    }

    const client = await Client.create({
        name,
        email,
        team_id: targetTeamId
    });

    res.json({
        done: true,
        body: client
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ done: false, message: 'Failed to create client' });
  }
});

module.exports = router;

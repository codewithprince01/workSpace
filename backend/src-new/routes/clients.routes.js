const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Apply protection to all routes
router.use(protect);

// GET /api/clients - Get all clients
router.get('/', async (req, res) => {
  try {
    const { Client, TeamMember, Project } = require('../models');
    
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
    
    // Get project counts for each client
    const clientIds = clients.map(c => c._id);
    const projectCounts = await Project.aggregate([
      { $match: { client_id: { $in: clientIds }, is_archived: false } },
      { $group: { _id: '$client_id', count: { $sum: 1 } } }
    ]);
    
    const countMap = {};
    projectCounts.forEach(pc => {
      countMap[pc._id.toString()] = pc.count;
    });
    
    // Map _id to id for frontend compatibility and add projects_count
    const mappedClients = clients.map(client => ({
        ...client.toObject(),
        id: client._id,
        projects_count: countMap[client._id.toString()] || 0
    }));
    
    res.json({
      done: true,
      body: {
        data: mappedClients,
        total: mappedClients.length
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
        body: {
            ...client.toObject(),
            id: client._id
        }
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ done: false, message: 'Failed to create client' });
  }
});

// PUT /api/clients/:id - Update client
router.put('/:id', async (req, res) => {
  try {
    const { name, email } = req.body;
    const { Client } = require('../models');
    
    const client = await Client.findByIdAndUpdate(
        req.params.id,
        { name, email },
        { new: true, runValidators: true }
    );
    
    if (!client) {
        return res.status(404).json({ done: false, message: 'Client not found' });
    }

    res.json({ done: true, body: { ...client.toObject(), id: client._id } });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ done: false, message: 'Failed to update client' });
  }
});

// DELETE /api/clients/:id - Delete client
router.delete('/:id', async (req, res) => {
  try {
    const { Client } = require('../models');
    const client = await Client.findByIdAndDelete(req.params.id);
    
    if (!client) {
        return res.status(404).json({ done: false, message: 'Client not found' });
    }

    res.json({ done: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ done: false, message: 'Failed to delete client' });
  }
});

module.exports = router;

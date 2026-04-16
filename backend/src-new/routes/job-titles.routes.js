const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

// GET /api/job-titles
router.get('/', async (req, res) => {
  try {
    const { JobTitle } = require('../models');
    const { TeamMember } = require('../models');
    
    // Find user's team
    let teamId = req.query.team_id;
    if (!teamId) {
       const member = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
       teamId = member?.team_id;
    }

    if (!teamId) {
        return res.json({ done: true, body: { data: [], total: 0 } });
    }

    const jobTitles = await JobTitle.find({ team_id: teamId, is_archived: false });
    
    const search = req.query.search?.toLowerCase();
    const filtered = search 
      ? jobTitles.filter(j => j.name.toLowerCase().includes(search))
      : jobTitles;

    // Map _id to id for frontend compatibility
    const mappedJobTitles = filtered.map(jt => ({
        ...jt.toObject(),
        id: jt._id
    }));

    res.json({
      done: true,
      body: {
        data: mappedJobTitles,
        total: mappedJobTitles.length
      }
    });
  } catch (error) {
    console.error('Get job titles error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch job titles' });
  }
});

// GET /api/job-titles/:id - Get single job title
router.get('/:id', async (req, res) => {
  try {
    const { JobTitle } = require('../models');
    
    const jobTitle = await JobTitle.findById(req.params.id);
    
    if (!jobTitle) {
        return res.status(404).json({ done: false, message: 'Job title not found' });
    }

    res.json({ done: true, body: { ...jobTitle.toObject(), id: jobTitle._id } });
  } catch (error) {
    console.error('Get job title error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch job title' });
  }
});

// POST /api/job-titles - Create job title
router.post('/', async (req, res) => {
  try {
    const { name, team_id } = req.body;
    const { JobTitle, TeamMember, Team } = require('../models');

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

    const jobTitle = await JobTitle.create({
        name,
        team_id: targetTeamId
    });

    res.json({
        done: true,
        body: {
            ...jobTitle.toObject(),
            id: jobTitle._id
        }
    });
  } catch (error) {
    console.error('Create job title error:', error);
    res.status(500).json({ done: false, message: 'Failed to create job title' });
  }
});

// PUT /api/job-titles/:id - Update job title
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const { JobTitle } = require('../models');
    
    const jobTitle = await JobTitle.findByIdAndUpdate(
        req.params.id,
        { name },
        { new: true, runValidators: true }
    );
    
    if (!jobTitle) {
        return res.status(404).json({ done: false, message: 'Job title not found' });
    }

    res.json({ done: true, body: { ...jobTitle.toObject(), id: jobTitle._id } });
  } catch (error) {
    console.error('Update job title error:', error);
    res.status(500).json({ done: false, message: 'Failed to update job title' });
  }
});

// DELETE /api/job-titles/:id - Delete job title
router.delete('/:id', async (req, res) => {
  try {
    const { JobTitle } = require('../models');
    const jobTitle = await JobTitle.findByIdAndDelete(req.params.id);
    
    if (!jobTitle) {
        return res.status(404).json({ done: false, message: 'Job title not found' });
    }

    res.json({ done: true, message: 'Job title deleted successfully' });
  } catch (error) {
    console.error('Delete job title error:', error);
    res.status(500).json({ done: false, message: 'Failed to delete job title' });
  }
});

module.exports = router;

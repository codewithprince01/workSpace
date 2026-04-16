const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Apply protection to all routes
router.use(protect);

// GET /api/project-categories - Get all project categories
router.get('/', async (req, res) => {
  try {
    const { ProjectCategory, TeamMember, Team, Project } = require('../models');
    
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
    
    // Get project counts for each category
    const categoryIds = categories.map(c => c._id);
    const projectCounts = await Project.aggregate([
      { $match: { category_id: { $in: categoryIds }, is_archived: false } },
      { $group: { _id: '$category_id', count: { $sum: 1 } } }
    ]);
    
    const countMap = {};
    projectCounts.forEach(pc => {
      countMap[pc._id.toString()] = pc.count;
    });
    
    // Normalize output to match frontend expectations
    const normalizedCategories = categories.map(category => ({
      id: String(category._id),
      name: category.name || '',
      color_code: category.color_code || '#1890ff',
      team_id: category.team_id ? String(category.team_id) : null,
      is_archived: category.is_archived || false,
      usage: category.usage || 0,
      project_count: countMap[category._id.toString()] || 0
    }));
    
    res.json({
      done: true,
      body: normalizedCategories
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
        body: {
          ...category.toObject(),
          id: category._id
        }
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ done: false, message: 'Failed to create category' });
  }
});

// PUT /api/project-categories/:id - Update category
router.put('/:id', async (req, res) => {
  try {
    const { name, color_code } = req.body;
    const { ProjectCategory } = require('../models');
    
    const updateData = {};
    if (name) updateData.name = name;
    if (color_code) updateData.color_code = color_code;
    
    const category = await ProjectCategory.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
    );
    
    if (!category) {
        return res.status(404).json({ done: false, message: 'Category not found' });
    }

    const normalizedCategory = {
      id: String(category._id),
      name: category.name || '',
      color_code: category.color_code || '#1890ff',
      team_id: category.team_id ? String(category.team_id) : null,
      is_archived: category.is_archived || false,
      usage: category.usage || 0
    };

    res.json({ done: true, body: normalizedCategory });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ done: false, message: 'Failed to update category' });
  }
});

// DELETE /api/project-categories/:id - Delete category
router.delete('/:id', async (req, res) => {
  try {
    const { ProjectCategory } = require('../models');
    const category = await ProjectCategory.findByIdAndDelete(req.params.id);
    
    if (!category) {
        return res.status(404).json({ done: false, message: 'Category not found' });
    }

    res.json({ done: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ done: false, message: 'Failed to delete category' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Apply protection to all routes
router.use(protect);

// GET /api/labels
router.get('/', async (req, res) => {
  try {
    const { TaskLabel } = require('../models');
    const { project_id } = req.query; // If applicable
    
    // Labels can be global or project specific. For simplicity, fetch all global or associated with project.
    let query = {};
    if (project_id) {
        query = { $or: [{ project_id: project_id }, { is_global: true }] };
    }
    
    const labels = await TaskLabel.find(query);
    
    // Normalize output to match frontend expectations
    const normalizedLabels = labels.map(label => ({
      id: String(label._id),
      name: label.name || '',
      color_code: label.color_code || '#1890ff',
      team_id: label.team_id ? String(label.team_id) : null,
      project_id: label.project_id ? String(label.project_id) : null,
      is_global: label.is_global || false,
      usage: label.usage || 0
    }));
    
    res.json({ done: true, body: normalizedLabels });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch labels' });
  }
});

// POST /api/labels
router.post('/', async (req, res) => {
    try {
        const { TaskLabel } = require('../models');
        const { name, color_code, project_id } = req.body;
        
        const label = await TaskLabel.create({
            name,
            color_code,
            project_id
        });
        
        res.status(201).json({ done: true, body: label });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to create label' });
    }
});

// PUT /api/labels/team/:id - Update label
router.put('/team/:id', async (req, res) => {
  try {
    const { TaskLabel } = require('../models');
    const { name, color } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (color) updateData.color_code = color;
    
    const label = await TaskLabel.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
    );
    
    if (!label) {
        return res.status(404).json({ done: false, message: 'Label not found' });
    }

    const normalizedLabel = {
      id: String(label._id),
      name: label.name || '',
      color_code: label.color_code || '#1890ff',
      team_id: label.team_id ? String(label.team_id) : null,
      project_id: label.project_id ? String(label.project_id) : null,
      is_global: label.is_global || false,
      usage: label.usage || 0
    };

    res.json({ done: true, body: normalizedLabel });
  } catch (error) {
    console.error('Update label error:', error);
    res.status(500).json({ done: false, message: 'Failed to update label' });
  }
});

// DELETE /api/labels/team/:id - Delete label
router.delete('/team/:id', async (req, res) => {
  try {
    const { TaskLabel } = require('../models');
    const label = await TaskLabel.findByIdAndDelete(req.params.id);
    
    if (!label) {
        return res.status(404).json({ done: false, message: 'Label not found' });
    }

    res.json({ done: true, message: 'Label deleted successfully' });
  } catch (error) {
    console.error('Delete label error:', error);
    res.status(500).json({ done: false, message: 'Failed to delete label' });
  }
});

// GET /api/labels/project/:projectId
// Returns all labels for the team that owns this project,
// since labels in this system are team-scoped (TaskLabel has team_id, not project_id).
router.get('/project/:projectId', async (req, res) => {
  try {
    const { TaskLabel, Task } = require('../models');
    const { Project } = require('../models');
    const mongoose = require('mongoose');
    const { projectId } = req.params;

    // Validate projectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.json({ done: true, body: [] });
    }

    // 1. Find the project to get its team_id
    const project = await Project.findById(projectId).select('team_id').lean();
    
    let labels = [];
    
    if (project && project.team_id) {
      // 2. Return all labels belonging to this team
      labels = await TaskLabel.find({ team_id: project.team_id }).lean();
    } else {
      // 3. Fallback: find labels used in tasks of this project
      const tasks = await Task.find({ project_id: projectId, is_trashed: false })
        .select('labels')
        .populate('labels', 'name color_code team_id')
        .lean();
      
      const labelMap = new Map();
      tasks.forEach(task => {
        (task.labels || []).forEach(label => {
          if (label && label._id) {
            labelMap.set(String(label._id), label);
          }
        });
      });
      labels = Array.from(labelMap.values());
    }

    // Normalize output to match frontend expectations
    const normalizedLabels = labels.map(label => ({
      id: String(label._id || label.id),
      name: label.name || '',
      color_code: label.color_code || '#1890ff',
      team_id: label.team_id ? String(label.team_id) : null,
    }));

    res.json({ done: true, body: normalizedLabels });
  } catch (error) {
    console.error('Failed to fetch project labels:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch project labels' });
  }
});

module.exports = router;

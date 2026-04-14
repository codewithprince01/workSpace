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
    res.json({ done: true, body: labels });
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

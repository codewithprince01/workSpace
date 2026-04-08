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
router.get('/project/:projectId', async (req, res) => {
  try {
    const { TaskLabel } = require('../models');
    const { projectId } = req.params;
    const labels = await TaskLabel.find({ project_id: projectId });
    res.json({ done: true, body: labels });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch project labels' });
  }
});

module.exports = router;

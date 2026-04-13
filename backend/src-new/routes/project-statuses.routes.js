const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Apply protection to all routes
router.use(protect);

// GET /categories - Get available status categories
router.get('/categories', (req, res) => {
  res.json({
    done: true,
    body: [
      { id: 'todo', key: 'todo', name: 'To Do', label: 'To Do', color_code: '#dbdbdb' },
      { id: 'doing', key: 'doing', name: 'Doing', label: 'Doing', color_code: '#2196f3' },
      { id: 'done', key: 'done', name: 'Done', label: 'Done', color_code: '#4caf50' }
    ]
  });
});

// GET /api/project-statuses - Get all project statuses
router.get('/', async (req, res) => {
  try {
    const { TaskStatus } = require('../models');
    const { project_id, project } = req.query;
    const targetProjectId = project_id || project;

    if (!targetProjectId) {
       return res.json({ done: true, body: [] });
    }

    const statuses = await TaskStatus.find({ project_id: targetProjectId })
      .sort({ sort_order: 1 });

    res.json({
      done: true,
      body: statuses
    });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch project statuses' });
  }
});

// POST /api/project-statuses - Create status
router.post('/', async (req, res) => {
   console.log('=== DEBUG: Create Status Request ===');
   console.log('Body:', JSON.stringify(req.body, null, 2));
   try {
     const { TaskStatus } = require('../models');
     const { project_id, name, color_code, category, category_id } = req.body;
     
     // Use category_id if category is not provided (frontend sends category_id)
     const statusCategory = category || category_id || 'doing';
     
     if (!project_id) {
       console.log('ERROR: Missing project_id');
       return res.status(400).json({ done: false, message: 'project_id is required' });
     }
     if (!name) {
       console.log('ERROR: Missing name');
       return res.status(400).json({ done: false, message: 'name is required' });
     }
     
     // Get max sort order
     const lastStatus = await TaskStatus.findOne({ project_id }).sort({ sort_order: -1 });
     const sort_order = lastStatus ? lastStatus.sort_order + 1 : 0;
     
     const status = await TaskStatus.create({
        project_id,
        name,
        color_code: color_code || '#cccccc',
        category: statusCategory,
        sort_order
     });
     
     console.log('SUCCESS: Created status:', status._id);
     res.status(201).json({ done: true, body: status });
   } catch (error) {
     console.log('ERROR creating status:', error.message);
     res.status(500).json({ done: false, message: error.message || 'Failed to create status' });
   }
});

// PUT /api/project-statuses/:id - Update status
router.put('/:id', async (req, res) => {
    try {
        const { TaskStatus } = require('../models');
        const { name, color_code, sort_order, category } = req.body;
        
        const status = await TaskStatus.findById(req.params.id);
        if (!status) return res.status(404).json({ done: false, message: 'Status not found' });
        
        if (name) status.name = name;
        if (color_code) status.color_code = color_code;
        if (sort_order !== undefined) status.sort_order = sort_order;
        if (category) status.category = category;
        
        await status.save();
        res.json({ done: true, body: status });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to update status' });
    }
});

// DELETE /api/project-statuses/:id
router.delete('/:id', async (req, res) => {
    try {
        const { TaskStatus, Task } = require('../models');
        const statusId = req.params.id;
        const replaceStatusId = req.query.replace;

        const status = await TaskStatus.findById(statusId);
        if (!status) {
          return res.status(404).json({ done: false, message: 'Status not found' });
        }

        // Pick replacement status from query, otherwise fallback to another status in same project.
        let replacement = null;
        if (replaceStatusId && String(replaceStatusId) !== String(statusId)) {
          replacement = await TaskStatus.findOne({
            _id: replaceStatusId,
            project_id: status.project_id,
          });
        }

        if (!replacement) {
          replacement = await TaskStatus.findOne({
            project_id: status.project_id,
            _id: { $ne: status._id },
          }).sort({ sort_order: 1 });
        }

        const tasksUsingStatus = await Task.countDocuments({
          project_id: status.project_id,
          status_id: status._id,
        });

        if (!replacement && tasksUsingStatus > 0) {
          return res.status(400).json({
            done: false,
            message: 'Cannot delete status because tasks still use it and no replacement status is available',
          });
        }

        // Move tasks from deleted status to replacement so deleted status does not keep showing in task list.
        let movedTasksCount = 0;
        if (replacement) {
          const moved = await Task.updateMany(
            { project_id: status.project_id, status_id: status._id },
            { $set: { status_id: replacement._id } }
          );
          movedTasksCount = Number(moved?.modifiedCount || moved?.nModified || 0);
        }

        await TaskStatus.deleteOne({ _id: status._id });

        res.json({
          done: true,
          body: {
            replaced_with: replacement?._id || null,
            moved_tasks: movedTasksCount,
          },
        });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to delete status' });
    }
});

module.exports = router;

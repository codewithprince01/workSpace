const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TimeLog, Task } = require('../models');

// Apply protection
router.use(protect);

// GET /api/time-logs - Get time logs
router.get('/', async (req, res) => {
  try {
    const { task_id, user_id, project_id, start_date, end_date } = req.query;
    
    let query = {};
    if (task_id) query.task_id = task_id;
    if (user_id) query.user_id = user_id;
    if (start_date && end_date) {
        query.logged_date = { $gte: new Date(start_date), $lte: new Date(end_date) };
    }
    
    // If filtering by project, we first need to find tasks in that project
    if (project_id) {
        const tasks = await Task.find({ project_id }).select('_id');
        const taskIds = tasks.map(t => t._id);
        query.task_id = { $in: taskIds };
    }

    const logs = await TimeLog.find(query)
      .populate('user_id', 'name email avatar_url')
      .populate('task_id', 'name project_id') // Might want to populate project too
      .sort({ logged_date: -1 });

    res.json({
      done: true,
      body: logs, // Some frontends expect { data: logs, total: count }
      total: logs.length
    });
  } catch (error) {
    console.error('Fetch time logs error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch time logs' });
  }
});

// POST /api/time-logs - Create time log
router.post('/', async (req, res) => {
  try {
    const { task_id, hours, description, logged_date } = req.body;
    
    if (!task_id || hours === undefined) {
        return res.status(400).json({ done: false, message: 'Task and hours are required' });
    }

    const log = await TimeLog.create({
        task_id,
        user_id: req.user._id,
        hours,
        description,
        logged_date: logged_date || new Date()
    });
    
    // Calculate total hours for task and update
    // Update task actual_hours
    // We can do this async or here
    // For now simple:
    
    // (Optional) Update task stats logic here if needed by app design
    
    const populatedLog = await TimeLog.findById(log._id)
        .populate('user_id', 'name email avatar_url');

    res.status(201).json({ done: true, body: populatedLog });
  } catch (error) {
    console.error('Create time log error:', error);
    res.status(500).json({ done: false, message: 'Failed to create time log' });
  }
});

// DELETE /api/time-logs/:id
router.delete('/:id', async (req, res) => {
    try {
        const log = await TimeLog.findById(req.params.id);
        if (!log) return res.status(404).json({ done: false, message: 'Log not found' });
        
        // Check permission (owner or admin)
        if (log.user_id.toString() !== req.user._id.toString() && !req.user.is_admin) {
             return res.status(403).json({ done: false, message: 'Not authorized' });
        }
        
        await log.deleteOne();
        res.json({ done: true });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to delete time log' });
    }
});

module.exports = router;

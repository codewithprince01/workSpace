const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { Task, TimeLog, Project, Team } = require('../models');

// Apply protection
router.use(protect);

// GET /api/logs/user-recent-tasks
router.get('/user-recent-tasks', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Find tasks assigned to user or reported by user, sorted by updated_at
    const tasks = await Task.find({
        $or: [{ assignees: req.user._id }, { reporter_id: req.user._id }],
        is_archived: false
    })
    .sort({ updated_at: -1 })
    .limit(limit)
    .populate('project_id', 'name key color_code')
    .populate('status_id', 'name color_code');

    // Format for frontend - matching IUserRecentTask interface
    const formatted = tasks.map(t => ({
        task_id: t._id,
        task_name: t.name,
        project_id: t.project_id?._id,
        project_name: t.project_id?.name || '',
        project_color: t.project_id?.color_code || '',
        last_activity_at: t.updated_at,
        activity_count: 1,
        task_status: t.status_id?.name || '',
        status_color: t.status_id?.color_code || ''
    }));

    // Return array directly as RTK Query expects
    res.json(formatted);
  } catch (error) {
    console.error('Fetch recent tasks error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch recent tasks' });
  }
});

// GET /api/logs/user-time-logged-tasks
router.get('/user-time-logged-tasks', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Find unique tasks user logged time on recently
    // Aggregate to get unique task ids sorted by max logged_date
    const logs = await TimeLog.aggregate([
        { $match: { user_id: req.user._id } },
        { $sort: { logged_date: -1 } },
        { $group: { 
            _id: '$task_id', 
            last_logged: { $first: '$logged_date' },
            total_hours: { $sum: '$hours' },
            log_count: { $sum: 1 }
          } 
        },
        { $sort: { last_logged: -1 } },
        { $limit: limit }
    ]);
    
    const taskIds = logs.map(l => l._id);
    
    const tasks = await Task.find({ _id: { $in: taskIds } })
        .populate('project_id', 'name key color_code')
        .populate('status_id', 'name color_code');
        
    // Map tasks back to logs order
    const tasksMap = new Map(tasks.map(t => [t._id.toString(), t]));
    
    // Format matching IUserTimeLoggedTask interface
    const formatted = logs.map(l => {
        const t = tasksMap.get(l._id?.toString());
        if (!t) return null;
        const hours = Math.floor(l.total_hours || 0);
        const mins = Math.round(((l.total_hours || 0) - hours) * 60);
        return {
            task_id: t._id,
            task_name: t.name,
            project_id: t.project_id?._id,
            project_name: t.project_id?.name || '',
            project_color: t.project_id?.color_code || '',
            total_time_logged: l.total_hours || 0,
            total_time_logged_string: `${hours}h ${mins}m`,
            last_logged_at: l.last_logged,
            logged_by_timer: false,
            task_status: t.status_id?.name || '',
            status_color: t.status_id?.color_code || '',
            log_entries_count: l.log_count
        };
    }).filter(Boolean);

    // Return array directly
    res.json(formatted);
  } catch (error) {
    console.error('Fetch time logged tasks error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch time logged tasks' });
  }
});

module.exports = router;

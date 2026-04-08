const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { ActivityLog, Task, User } = require('../models');

// Apply protection
router.use(protect);

// GET /api/activity-logs/:taskId
router.get('/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        
        // Fetch Task details for header info
        const task = await Task.findById(taskId).populate('reporter_id', 'name avatar_url');
        
        if (!task) {
             return res.status(404).json({ done: false, message: 'Task not found' });
        }

        const logs = await ActivityLog.find({ task_id: taskId })
            .populate('done_by', 'name avatar_url')
            .sort({ created_at: -1 });

        // Map to frontend expected format
        const formattedLogs = logs.map(log => ({
            id: log._id,
            log_text: log.log_text,
            attribute_type: log.attribute_type,
            log_type: log.log_type,
            created_at: log.created_at,
            done_by: log.done_by ? {
                name: log.done_by.name,
                avatar_url: log.done_by.avatar_url
            } : null,
            previous_status: log.previous_status,
            next_status: log.next_status,
            previous: log.previous,
            current: log.current
            // Add other fields as needed
        }));

        const response = {
            logs: formattedLogs,
            name: task.reporter_id?.name || 'Unknown', // Who created?
            avatar_url: task.reporter_id?.avatar_url,
            created_at: task.created_at
        };

        res.json({ done: true, body: response });
    } catch (error) {
        console.error('Fetch activity logs error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch activity logs' });
    }
});

module.exports = router;

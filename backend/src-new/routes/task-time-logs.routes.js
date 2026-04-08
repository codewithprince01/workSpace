const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TimeLog, Task, RunningTimer, Project } = require('../models');

// Apply protection
router.use(protect);

// GET /api/task-time-log/running-timers
router.get('/running-timers', async (req, res) => {
    try {
        const timers = await RunningTimer.find({ user_id: req.user._id })
            .populate('task_id', 'name project_id')
            .populate('project_id', 'name');

        const formatted = timers.map(t => ({
            task_id: t.task_id?._id,
            start_time: t.start_time,
            task_name: t.task_id?.name,
            project_id: t.project_id?._id,
            project_name: t.project_id?.name
        })).filter(t => t.task_id); // Filter out nulls

        res.json({ done: true, body: formatted });
    } catch (error) {
        console.error('Fetch running timers error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch running timers' });
    }
});

// GET /api/task-time-log/task/:id - Get time logs for a task
router.get('/task/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const logs = await TimeLog.find({ task_id: id })
            .populate('user_id', 'name avatar_url')
            .sort({ logged_date: -1 });

        const formattedLogs = logs.map(log => ({
            id: log._id,
            task_id: log.task_id,
            user_id: log.user_id?._id,
            user_name: log.user_id?.name,
            avatar_url: log.user_id?.avatar_url,
            time_spent: Math.round((log.hours || 0) * 3600), // Convert hours to seconds
            time_spent_text: formatTimeSpent(log.hours || 0),
            date: log.logged_date,
            description: log.description
        }));

        res.json({ done: true, body: formattedLogs });
    } catch (error) {
        console.error('Fetch task logs error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch task logs' });
    }
});

// POST /api/task-time-log - Create a time log
router.post('/', async (req, res) => {
    try {
        const { task_id, time_spent, description, logged_date } = req.body;
        
        if (!task_id) {
            return res.status(400).json({ done: false, message: 'task_id is required' });
        }

        // time_spent is in seconds from frontend, convert to hours
        const hours = (time_spent || 0) / 3600;

        const log = await TimeLog.create({
            task_id,
            user_id: req.user._id,
            hours,
            description: description || '',
            logged_date: logged_date ? new Date(logged_date) : new Date()
        });

        const populatedLog = await TimeLog.findById(log._id)
            .populate('user_id', 'name avatar_url');

        res.status(201).json({
            done: true,
            body: {
                id: populatedLog._id,
                task_id: populatedLog.task_id,
                user_id: populatedLog.user_id?._id,
                user_name: populatedLog.user_id?.name,
                avatar_url: populatedLog.user_id?.avatar_url,
                time_spent: time_spent,
                time_spent_text: formatTimeSpent(hours),
                date: populatedLog.logged_date,
                description: populatedLog.description
            }
        });
    } catch (error) {
        console.error('Create time log error:', error);
        res.status(500).json({ done: false, message: 'Failed to create time log' });
    }
});

// PUT /api/task-time-log/:id - Update a time log
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { time_spent, description, logged_date } = req.body;

        const log = await TimeLog.findById(id);
        if (!log) {
            return res.status(404).json({ done: false, message: 'Time log not found' });
        }

        // Check permission
        if (log.user_id.toString() !== req.user._id.toString() && !req.user.is_admin) {
            return res.status(403).json({ done: false, message: 'Not authorized' });
        }

        if (time_spent !== undefined) {
            log.hours = time_spent / 3600; // Convert seconds to hours
        }
        if (description !== undefined) {
            log.description = description;
        }
        if (logged_date) {
            log.logged_date = new Date(logged_date);
        }

        await log.save();

        const populatedLog = await TimeLog.findById(log._id)
            .populate('user_id', 'name avatar_url');

        res.json({
            done: true,
            body: {
                id: populatedLog._id,
                task_id: populatedLog.task_id,
                user_id: populatedLog.user_id?._id,
                user_name: populatedLog.user_id?.name,
                avatar_url: populatedLog.user_id?.avatar_url,
                time_spent: Math.round(populatedLog.hours * 3600),
                time_spent_text: formatTimeSpent(populatedLog.hours),
                date: populatedLog.logged_date,
                description: populatedLog.description
            }
        });
    } catch (error) {
        console.error('Update time log error:', error);
        res.status(500).json({ done: false, message: 'Failed to update time log' });
    }
});

// DELETE /api/task-time-log/:id - Delete a time log
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const log = await TimeLog.findById(id);
        if (!log) {
            return res.status(404).json({ done: false, message: 'Time log not found' });
        }

        // Check permission
        if (log.user_id.toString() !== req.user._id.toString() && !req.user.is_admin) {
            return res.status(403).json({ done: false, message: 'Not authorized' });
        }

        await log.deleteOne();
        res.json({ done: true });
    } catch (error) {
        console.error('Delete time log error:', error);
        res.status(500).json({ done: false, message: 'Failed to delete time log' });
    }
});

// Helper function to format time spent
function formatTimeSpent(hours) {
    if (!hours || hours === 0) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

module.exports = router;

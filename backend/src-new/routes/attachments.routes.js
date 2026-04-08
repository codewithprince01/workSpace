const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TaskAttachment, Task } = require('../models');

// Apply protection
router.use(protect);

// GET /api/attachments/tasks/:taskId - Get attachments for a task
router.get('/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const attachments = await TaskAttachment.find({ task_id: taskId })
            .populate('user_id', 'name email avatar_url')
            .sort({ created_at: -1 });

        const formatted = attachments.map(a => ({
            id: a._id,
            task_id: a.task_id,
            file_name: a.file_name,
            file_size: a.file_size,
            file_type: a.file_type,
            url: a.url,
            created_at: a.created_at,
            user_name: a.user_id?.name,
            user_id: a.user_id?._id
        }));

        res.json({ done: true, body: formatted });
    } catch (error) {
        console.error('Fetch task attachments error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch task attachments' });
    }
});

// POST /api/attachments/tasks - Create attachment entry (after upload)
router.post('/tasks', async (req, res) => {
    try {
        const { task_id, file_name, file_key, file_size, file_type, url } = req.body;

        if (!task_id || !file_name || !file_key) {
            return res.status(400).json({ done: false, message: 'Missing required fields' });
        }

        const attachment = await TaskAttachment.create({
            task_id,
            user_id: req.user._id,
            file_name,
            file_key,
            file_size,
            file_type,
            url
        });

        const populated = await TaskAttachment.findById(attachment._id)
            .populate('user_id', 'name email avatar_url');

        res.status(201).json({ 
            done: true, 
            body: {
                id: populated._id,
                task_id: populated.task_id,
                file_name: populated.file_name,
                file_size: populated.file_size,
                file_type: populated.file_type,
                url: populated.url,
                created_at: populated.created_at,
                user_name: populated.user_id?.name
            }
        });
    } catch (error) {
        console.error('Create task attachment error:', error);
        res.status(500).json({ done: false, message: 'Failed to create task attachment' });
    }
});

// DELETE /api/attachments/tasks/:id
router.delete('/tasks/:id', async (req, res) => {
    try {
        const attachment = await TaskAttachment.findById(req.params.id);
        if (!attachment) {
            return res.status(404).json({ done: false, message: 'Attachment not found' });
        }

        // Check permission
        if (attachment.user_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ done: false, message: 'Not authorized' });
        }

        await TaskAttachment.deleteOne({ _id: attachment._id });
        res.json({ done: true });
    } catch (error) {
        console.error('Delete attachment error:', error);
        res.status(500).json({ done: false, message: 'Failed to delete attachment' });
    }
});

// GET /api/attachments/project/:projectId
router.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { index, size } = req.query;
        
        const page = parseInt(index) || 1;
        const limit = parseInt(size) || 20;
        const skip = (page - 1) * limit;

        // Find tasks in project
        const tasks = await Task.find({ project_id: projectId }).select('_id');
        const taskIds = tasks.map(t => t._id);

        const attachments = await TaskAttachment.find({ task_id: { $in: taskIds } })
            .populate('user_id', 'name email avatar_url')
            .populate({
                path: 'task_id',
                select: 'name'
            })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);

        const total = await TaskAttachment.countDocuments({ task_id: { $in: taskIds } });

        const formatted = attachments.map(a => ({
            id: a._id,
            task_id: a.task_id?._id || a.task_id,
            task_name: a.task_id?.name,
            file_name: a.file_name,
            file_size: a.file_size,
            file_type: a.file_type,
            url: a.url,
            created_at: a.created_at,
            user_name: a.user_id?.name
        }));

        res.json({ 
            done: true, 
            body: {
                data: formatted,
                total
            }
        });
    } catch (error) {
        console.error('Fetch project attachments error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch project attachments' });
    }
});

module.exports = router;

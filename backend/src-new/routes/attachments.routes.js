const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TaskAttachment, Task } = require('../models');
const storageService = require('../services/storage.service');
const logger = require('../utils/logger');

// Apply protection
router.use(protect);

/**
 * POST /api/attachments/avatar
 * Upload user avatar
 */
router.post('/avatar', async (req, res) => {
    try {
        const { file, file_name, size } = req.body;

        if (!file || !file_name) {
            return res.status(400).json({ done: false, message: 'file and file_name are required' });
        }

        // Generate a unique key for the avatar
        const key = `avatars/${req.user._id}-${Date.now()}-${file_name}`;

        // Upload the file to storage
        const url = await storageService.uploadBase64(key, file, file_name);

        // Update user's avatar_url
        const { User } = require('../models');
        await User.findByIdAndUpdate(req.user._id, { avatar_url: url });

        res.json({
            done: true,
            body: { url }
        });
    } catch (error) {
        logger.error('Avatar upload error: %s', error.message);
        res.status(500).json({ done: false, message: 'Failed to upload avatar' });
    }
});

/**
 * GET /api/attachments/upload-url
 * Returns a presigned URL for secure frontend upload
 */
router.post('/upload-url', async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        if (!fileName) return res.status(400).json({ done: false, message: 'fileName is required' });

        const key = `task-attachments/${Date.now()}-${fileName}`;
        const uploadUrl = await storageService.getUploadUrl(key, fileType || 'application/octet-stream');
        
        // Return both the signed URL and the final key to be saved later
        res.json({
            done: true,
            body: {
                upload_url: uploadUrl,
                file_key: key
            }
        });
    } catch (error) {
        logger.error('Failed to generate upload URL: %s', error.message);
        res.status(500).json({ done: false, message: 'Failed to generate upload URL' });
    }
});

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

// POST /api/attachments/tasks - Create attachment entry
router.post('/tasks', async (req, res) => {
    try {
        const { task_id, file_name, file_key, file_size, file_type, url, file, size } = req.body;

        if (!task_id || !file_name) {
            return res.status(400).json({ done: false, message: 'Missing task_id or file_name' });
        }

        // Handle case where frontend sends "file" (base64) and "size" instead of key/url
        const finalKey = file_key || `task-files/${Date.now()}-${file_name}`;
        const finalUrl = url || file; // In a real app, this would be an S3 URL
        const finalSize = file_size || size || 0;
        const finalType = file_type || (file_name.split('.').pop() || 'file');

        const attachment = await TaskAttachment.create({
            task_id,
            user_id: req.user._id,
            file_name,
            file_key: finalKey,
            file_size: finalSize,
            file_type: finalType,
            url: finalUrl
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

        // 1. Physically delete file from storage
        if (attachment.file_key) {
            await storageService.deleteFile(attachment.file_key);
        }

        // 2. Delete database record
        await TaskAttachment.deleteOne({ _id: attachment._id });
        
        res.json({ done: true });
    } catch (error) {
        logger.error('Delete attachment error: %s', error.message);
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

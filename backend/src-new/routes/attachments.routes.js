const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TaskAttachment, Task, ProjectMember } = require('../models');
const storageService = require('../services/storage.service');
const logger = require('../utils/logger');

// Apply auth protection to all routes
router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attachments/avatar
// Upload user profile avatar (base64 → storage → DB)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/avatar', async (req, res) => {
    try {
        const { file, file_name, size } = req.body;

        if (!file || !file_name) {
            return res.status(400).json({ done: false, message: 'file and file_name are required' });
        }

        const ext = file_name.split('.').pop() || 'png';
        const key = `avatars/${req.user._id}-${Date.now()}.${ext}`;

        // Upload to configured structured storage and get HTTP URL
        const url = await storageService.uploadBase64(key, file, file_name, req.user._id);

        // Persist URL in User document
        const { User } = require('../models');
        await User.findByIdAndUpdate(req.user._id, { avatar_url: url });

        res.json({ done: true, body: { url } });
    } catch (error) {
        logger.error('Avatar upload error: %s', error.message);
        res.status(500).json({ done: false, message: 'Failed to upload avatar' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attachments/upload-url
// Returns a presigned URL for direct frontend upload (S3 flow)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload-url', async (req, res) => {
    return res.status(410).json({
        done: false,
        message: 'Direct upload URLs are disabled. Upload files through backend attachment APIs.',
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/attachments/local-upload/*
// Legacy endpoint intentionally disabled (local storage is not allowed)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/local-upload/*', express.raw({ type: '*/*', limit: '200mb' }), async (req, res) => {
    return res.status(410).json({
        done: false,
        message: 'Local upload endpoint is disabled. Upload files through backend attachment APIs.',
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attachments/tasks/:taskId
// List all attachments for a task
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const attachments = await TaskAttachment.find({ task_id: taskId })
            .populate('user_id', 'name email avatar_url')
            .sort({ created_at: -1 });

        const formatted = attachments.map(a => ({
            id: a._id,
            task_id: a.task_id,
            project_id: a.project_id,
            file_name: a.file_name,
            name: a.file_name,
            file_size: a.file_size,
            size: a.file_size,
            file_type: a.file_type,
            type: a.file_type,
            url: a.url,
            created_at: a.created_at,
            user_name: a.user_id?.name,
            uploader_name: a.user_id?.name,
            user_id: a.user_id?._id
        }));

        res.json({ done: true, body: formatted });
    } catch (error) {
        console.error('Fetch task attachments error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch task attachments' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attachments/tasks
// Create task attachment — uploads base64 to storage, stores HTTP URL in DB
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tasks', async (req, res) => {
    try {
        const { task_id, project_id, file_name, file_size, file_type, file, size } = req.body;

        if (!file_name) {
            return res.status(400).json({ done: false, message: 'Missing file_name' });
        }

        let finalTaskId = task_id || null;
        let finalProjectId = project_id || null;

        // Auto-resolve project_id from task if not provided
        if (finalTaskId && !finalProjectId) {
            const task = await Task.findById(finalTaskId).select('project_id');
            if (!task) {
                return res.status(400).json({ done: false, message: 'Invalid task_id' });
            }
            finalProjectId = task.project_id;
        }

        if (!finalProjectId) {
            return res.status(400).json({ done: false, message: 'Missing project_id' });
        }

        const finalSize = file_size || size || 0;
        const finalType = file_type || (file_name.split('.').pop() || 'file');
        if (!file || !String(file).trim()) {
            return res.status(400).json({ done: false, message: 'Missing file data' });
        }

        const finalKey = `task-attachments/${finalTaskId || 'general'}/${Date.now()}-${file_name}`;
        let finalUrl = null;

        try {
            finalUrl = await storageService.uploadBase64(finalKey, String(file), file_name, req.user._id);
            logger.info(`✅ Task attachment stored (base64): ${finalKey}`);
        } catch (uploadErr) {
            logger.error('Task attachment upload failed: %s', uploadErr.message);
            return res.status(500).json({ done: false, message: 'File upload failed: ' + uploadErr.message });
        }


        const attachment = await TaskAttachment.create({
            task_id: finalTaskId,
            project_id: finalProjectId,
            user_id: req.user._id,
            file_name,
            file_key: finalKey,
            file_size: finalSize,
            file_type: finalType,
            url: finalUrl   // ← Always a proper HTTP URL, never raw base64
        });

        const populated = await TaskAttachment.findById(attachment._id)
            .populate('user_id', 'name email avatar_url');

        res.status(201).json({
            done: true,
            body: {
                id: populated._id,
                task_id: populated.task_id,
                project_id: populated.project_id,
                file_name: populated.file_name,
                name: populated.file_name,
                file_size: populated.file_size,
                size: populated.file_size,
                file_type: populated.file_type,
                type: populated.file_type,
                url: populated.url,
                created_at: populated.created_at,
                user_name: populated.user_id?.name,
                uploader_name: populated.user_id?.name
            }
        });
    } catch (error) {
        console.error('Create task attachment error:', error);
        res.status(500).json({ done: false, message: 'Failed to create task attachment' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/attachments/tasks/:id
// Delete attachment record + physical file from storage
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/tasks/:id', async (req, res) => {
    try {
        const attachment = await TaskAttachment.findById(req.params.id);
        if (!attachment) {
            return res.status(404).json({ done: false, message: 'Attachment not found' });
        }

        // Permission check: uploader OR team admin/owner OR active project member
        const isUploader = attachment.user_id.toString() === req.user._id.toString();
        const isTeamAdmin = !!(req.user?.is_admin || req.user?.is_owner);
        const isProjectMember = !!(attachment.project_id && await ProjectMember.exists({
            project_id: attachment.project_id,
            user_id: req.user._id,
            is_active: true,
        }));

        if (!isUploader && !isTeamAdmin && !isProjectMember) {
            return res.status(403).json({ done: false, message: 'Not authorized' });
        }

        // Delete physical file from storage
        if (attachment.file_key) {
            await storageService.deleteFile(attachment.file_key);
        }

        // Delete database record
        await TaskAttachment.deleteOne({ _id: attachment._id });

        res.json({ done: true });
    } catch (error) {
        logger.error('Delete attachment error: %s', error.message);
        res.status(500).json({ done: false, message: 'Failed to delete attachment' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attachments/download?id=<attachmentId>
// Get download URL for an attachment
// ─────────────────────────────────────────────────────────────────────────────
router.get('/download', async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ done: false, message: 'id is required' });
        }

        const attachment = await TaskAttachment.findById(id);
        if (!attachment) {
            return res.status(404).json({ done: false, message: 'Attachment not found' });
        }

        // Generate a proper download URL
        let url = attachment.file_key
            ? await storageService.getDownloadUrl(attachment.file_key)
            : attachment.url;

        // Ensure URL is always absolute
        if (url && !/^https?:\/\//i.test(url)) {
            url = `http://${String(url).replace(/^\/+/, '')}`;
        }

        return res.json({ done: true, body: url });
    } catch (error) {
        logger.error('Download attachment error: %s', error.message);
        return res.status(500).json({ done: false, message: 'Failed to download attachment' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attachments/project/:projectId
// List all attachments for a project (paginated)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { index, size, view } = req.query;

        const page = parseInt(index) || 1;
        const limit = parseInt(size) || 20;
        const skip = (page - 1) * limit;
        const normalizedView = String(view || 'all').toLowerCase();

        const projectTaskIds = (await Task.find({ project_id: projectId }).select('_id'))
            .map(task => task._id);

        const query = {};
        if (normalizedView === 'project') {
            query.$or = [
                { project_id: projectId, task_id: null },
                { project_id: projectId, task_id: { $exists: false } }
            ];
        } else if (normalizedView === 'task') {
            query.$or = [
                { project_id: projectId, task_id: { $ne: null } },
                { task_id: { $in: projectTaskIds } }
            ];
        } else {
            query.$or = [
                { project_id: projectId },
                { task_id: { $in: projectTaskIds } }
            ];
        }

        const attachments = await TaskAttachment.find(query)
            .populate('user_id', 'name email avatar_url')
            .populate({ path: 'task_id', select: 'name task_key' })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);

        const total = await TaskAttachment.countDocuments(query);

        const formatted = attachments.map(a => ({
            id: a._id,
            task_id: a.task_id?._id || a.task_id,
            task_name: a.task_id?.name,
            task_key: a.task_id?.task_key || null,
            file_name: a.file_name,
            name: a.file_name,
            file_size: a.file_size,
            size: a.file_size,
            file_type: a.file_type,
            type: a.file_type,
            url: a.url,
            created_at: a.created_at,
            user_name: a.user_id?.name,
            uploader_name: a.user_id?.name
        }));

        res.json({
            done: true,
            body: { data: formatted, total }
        });
    } catch (error) {
        console.error('Fetch project attachments error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch project attachments' });
    }
});

module.exports = router;

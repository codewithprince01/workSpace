const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TaskAttachment, Task } = require('../models');
const storageService = require('../services/storage.service');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs-extra');

/**
 * ALL /api/attachments/local-upload/:key(*)
 * Public access for local development (upload and download)
 */
router.all('/local-upload/:key(*)?', async (req, res) => {
    try {
        const key = req.params.key || req.query.key;
        if (!key) return res.status(400).send('Missing key');
        
        const filePath = path.join(process.cwd(), 'uploads', key);

        if (req.method === 'PUT') {
            await fs.ensureDir(path.dirname(filePath));
            const writeStream = fs.createWriteStream(filePath);
            req.pipe(writeStream);
            writeStream.on('finish', () => res.status(200).send('Uploaded'));
            writeStream.on('error', () => res.status(500).send('Upload failed'));
            return;
        }

        if (req.method === 'GET') {
            if (!(await fs.exists(filePath))) return res.status(404).send('File not found');
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
            res.sendFile(filePath);
            return;
        }
        
        res.status(405).send('Method not allowed');
    } catch (error) {
        res.status(500).send('Internal error');
    }
});

// Apply protection for database operations
router.use(protect);

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

// Removed from here and moved above protect

// GET /api/attachments/tasks/:taskId - Get attachments for a task
router.get('/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const attachments = await TaskAttachment.find({ task_id: taskId })
            .populate('user_id', 'name email avatar_url')
            .sort({ created_at: -1 })
            .allowDiskUse(true);

        const formatted = attachments.map(a => ({
            id: a._id,
            task_id: a.task_id,
            name: a.file_name,
            size: a.file_size,
            type: a.file_type,
            url: a.url,
            created_at: a.created_at,
            uploader_name: a.user_id?.name,
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
        const { task_id, project_id, file_name, file_key, file_size, file_type, url, file, size } = req.body;

        if (!project_id && !task_id) {
            return res.status(400).json({ done: false, message: 'Missing project_id or task_id' });
        }

        if (!file_name) {
            return res.status(400).json({ done: false, message: 'Missing file_name' });
        }

        let finalProjectId = project_id;
        if (!finalProjectId && task_id) {
            const task = await Task.findById(task_id).select('project_id');
            if (task) finalProjectId = task.project_id;
        }

        if (!finalProjectId) {
            return res.status(400).json({ done: false, message: 'Project context not found' });
        }

        // Handle case where frontend sends "file" (base64) and "size" instead of key/url
        const finalKey = file_key || `task-files/${Date.now()}-${file_name}`;
        const finalUrl = url || file; 
        const finalSize = file_size || size || 0;
        const finalType = file_type || (file_name.split('.').pop() || 'file').toLowerCase();

        const attachment = await TaskAttachment.create({
            task_id: task_id || null,
            project_id: finalProjectId,
            user_id: req.user._id,
            file_name,
            file_key: finalKey,
            file_size: finalSize,
            file_type: finalType,
            url: finalUrl
        });

        const populated = await TaskAttachment.findById(attachment._id)
            .populate('user_id', 'name email avatar_url');

        // Update task's attachment count
        await Task.findByIdAndUpdate(task_id, { $inc: { attachments_count: 1 } });

        res.status(201).json({ 
            done: true, 
            message: 'Attachment uploaded successfully',
            body: {
                id: populated._id,
                task_id: populated.task_id,
                name: populated.file_name,
                size: populated.file_size,
                type: populated.file_type,
                url: populated.url,
                created_at: populated.created_at,
                user_name: populated.user_id?.name
            }
        });
    } catch (error) {
        console.error('Create task attachment error:', error);
        res.status(500).json({ done: false, message: 'Failed to create task attachment: ' + error.message });
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
        const attachmentOwnerId = attachment.user_id?._id
            ? attachment.user_id._id.toString()
            : attachment.user_id.toString();
        const requestUserId = req.user._id.toString();
        const isOwner = attachmentOwnerId === requestUserId;
        const isAdmin = req.user.is_admin === true;

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ done: false, message: 'Not authorized to delete this attachment' });
        }

        if (attachment.file_key) {
            try {
                await storageService.deleteFile(attachment.file_key);
            } catch (storageErr) {
                logger.warn('Storage delete failed (continuing): %s', storageErr.message);
            }
        }

        await TaskAttachment.deleteOne({ _id: attachment._id });
        await Task.findByIdAndUpdate(attachment.task_id, { $inc: { attachments_count: -1 } });
        
        res.json({ done: true, message: 'Attachment deleted successfully' });
    } catch (error) {
        logger.error('Delete attachment error: %s', error.message);
        res.status(500).json({ done: false, message: 'Failed to delete attachment' });
    }
});

router.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { index, size, view } = req.query;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ done: false, message: 'Invalid project ID format' });
        }
        
        const page = parseInt(index) || 1;
        const limit = parseInt(size) || 20;
        const skip = (page - 1) * limit;

        // 1. FAST PATH: Check if we have project-stamped data
        // We use project_id directly, which is 1000x faster than the $in array lookup
        let query = { project_id: projectId };
        
        if (view === 'project') {
            query.task_id = null;
        } else if (view === 'task') {
            query.task_id = { $ne: null };
        }

        // 2. DATA SELF-HEALING (Background Migration)
        // If this is the first time fetching this project, we might have old task attachments 
        // without project_id. We'll fix them in the background so future loads are instant.
        const checkOld = async () => {
            try {
                const tasks = await Task.find({ project_id: projectId }).select('_id').lean();
                const taskIds = (tasks || []).map(t => t._id);
                
                // Backfill project_id to old attachments that only have task_id
                const updateRes = await TaskAttachment.updateMany(
                    { task_id: { $in: taskIds }, project_id: { $exists: false } },
                    { $set: { project_id: projectId } }
                );
                
                if (updateRes.modifiedCount > 0) {
                    logger.info(`Self-healed ${updateRes.modifiedCount} attachments for project ${projectId}`);
                }
            } catch (err) {
                // Background error doesn't stop the request
                logger.error('Background migration error:', err);
            }
        };
        
        // Execute background heal (don't await)
        checkOld();

        // 3. ADAPTIVE QUERY:
        let queryResults = await TaskAttachment.find(query)
            .populate('user_id', 'name email avatar_url')
            .populate({
                path: 'task_id',
                select: 'name task_key'
            })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .allowDiskUse(true)
            .lean();

        let total = await TaskAttachment.countDocuments(query);

        // 4. LEGACY FALLBACK: If modern path empty for tasks, search legacy path for this specific request
        if (queryResults.length === 0 && (view === 'task' || !view)) {
             const tasks = await Task.find({ project_id: projectId }).select('_id').lean();
             const taskIds = (tasks || []).map(t => t._id);
             
             if (taskIds.length > 0) {
                 const legacyQuery = { task_id: { $in: taskIds } };
                 
                 queryResults = await TaskAttachment.find(legacyQuery)
                    .populate('user_id', 'name email avatar_url')
                    .populate({
                        path: 'task_id',
                        select: 'name task_key'
                    })
                    .sort({ created_at: -1 })
                    .skip(skip)
                    .limit(limit)
                    .allowDiskUse(true)
                    .lean();
                    
                 total = await TaskAttachment.countDocuments(legacyQuery);
             }
        }

        const attachments = queryResults;

        const formatted = attachments.map(a => {
            try {
                return {
                    id: a._id,
                    task_id: a.task_id?._id || a.task_id,
                    task_name: a.task_id?.name,
                    task_key: a.task_id?.task_key,
                    name: a.file_name,
                    size: a.file_size,
                    type: a.file_type,
                    url: a.url,
                    created_at: a.created_at,
                    uploader_name: a.user_id?.name
                };
            } catch (err) {
                logger.error('Error formatting attachment:', err);
                return null;
            }
        }).filter(Boolean);

        res.json({ 
            done: true, 
            body: {
                data: formatted,
                total
            }
        });
    } catch (error) {
        logger.error('Fetch project attachments error: %s', error.message);
        console.error(error); // Detailed stack in console
        res.status(500).json({ done: false, message: 'Failed to fetch project attachments: ' + error.message });
    }
});

// GET /api/attachments/download
router.get('/download', async (req, res) => {
    try {
        const { id } = req.query;
        const attachment = await TaskAttachment.findById(id);
        if (!attachment) {
            return res.status(404).json({ done: false, message: 'Attachment not found' });
        }

        let downloadUrl = attachment.url;
        
        // Fix for "bare" local URLs that are missing the key in the path or query
        if (downloadUrl && downloadUrl.includes('/local-upload') && !downloadUrl.includes(attachment.file_key)) {
            const host = process.env.BACKEND_URL || 'http://localhost:3000';
            downloadUrl = `${host}/api/attachments/local-upload/${attachment.file_key}`;
        }

        res.json({ done: true, body: downloadUrl });
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ done: false, message: 'Failed to generate download link' });
    }
});

module.exports = router;

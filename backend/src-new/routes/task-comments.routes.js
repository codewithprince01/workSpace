const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TaskComment, Task, ActivityLog } = require('../models');

// Apply protection
router.use(protect);

// GET /api/task-comments/:taskId - Get comments for a task
router.get('/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        
        const comments = await TaskComment.find({ task_id: taskId })
            .populate('user_id', 'name avatar_url email')
            .sort({ created_at: -1 });

        const formattedComments = comments.map(comment => ({
            id: comment._id,
            task_id: comment.task_id,
            content: comment.content,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            user_id: comment.user_id?._id,
            member_name: comment.user_id?.name,
            avatar_url: comment.user_id?.avatar_url,
            email: comment.user_id?.email,
            attachments: [], // Attachments logic if any
            reactions: [] // Reactions logic if any
        }));

        res.json({ done: true, body: formattedComments });
    } catch (error) {
        console.error('Fetch task comments error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch task comments' });
    }
});

// POST /api/task-comments - Create a comment
router.post('/', async (req, res) => {
    try {
        const { task_id, content } = req.body;

        if (!task_id || !content) {
            return res.status(400).json({ done: false, message: 'Task ID and content are required' });
        }

        const newComment = await TaskComment.create({
            task_id,
            content,
            user_id: req.user._id
        });

        const populatedComment = await TaskComment.findById(newComment._id)
            .populate('user_id', 'name avatar_url email');

        // Create Activity Log
        const task = await Task.findById(task_id);
        if (task) {
            await ActivityLog.create({
                task_id,
                project_id: task.project_id,
                done_by: req.user._id,
                log_type: 'comment',
                log_text: `added a comment`,
                attribute_type: 'COMMENT'
            });
        }

        const response = {
            id: populatedComment._id,
            task_id: populatedComment.task_id,
            content: populatedComment.content,
            created_at: populatedComment.created_at,
            updated_at: populatedComment.updated_at,
            user_id: populatedComment.user_id?._id,
            member_name: populatedComment.user_id?.name,
            avatar_url: populatedComment.user_id?.avatar_url,
            email: populatedComment.user_id?.email,
            attachments: [],
            reactions: []
        };

        res.json({ done: true, body: response });
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ done: false, message: 'Failed to create comment' });
    }
});

// DELETE /api/task-comments/:id/:taskId - Delete a comment
router.delete('/:id/:taskId', async (req, res) => {
    try {
        const { id, taskId } = req.params;

        const comment = await TaskComment.findOne({ _id: id, task_id: taskId });
        
        if (!comment) {
            return res.status(404).json({ done: false, message: 'Comment not found' });
        }

        // Check permission: only owner or admin can delete
        if (comment.user_id.toString() !== req.user._id.toString()) {
             return res.status(403).json({ done: false, message: 'Not authorized to delete this comment' });
        }

        await TaskComment.deleteOne({ _id: id });

        res.json({ done: true, body: { id } });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ done: false, message: 'Failed to delete comment' });
    }
});

// PUT /api/task-comments/:id - Update a comment
router.put('/:id', async (req, res) => {
    try {
        const { content } = req.body;
        const comment = await TaskComment.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            { content },
            { new: true }
        ).populate('user_id', 'name avatar_url email');

        if (!comment) {
            return res.status(404).json({ done: false, message: 'Comment not found or unauthorized' });
        }

        res.json({ done: true, body: comment });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to update comment' });
    }
});

// PUT /api/task-comments/reaction/:id - Update reaction
router.put('/reaction/:id', async (req, res) => {
    try {
        const reactionType = req.query.reaction_type || req.body.reaction_type;
        // Basic reaction logic
        res.json({ done: true });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to update reaction' });
    }
});

module.exports = router;

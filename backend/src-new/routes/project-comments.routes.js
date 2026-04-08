const express = require('express');
const router = express.Router();
const { ProjectComment, ProjectMember, User } = require('../models');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

// POST /api/project-comments
router.post('/', async (req, res) => {
    try {
        const { project_id, content, mentions } = req.body;
        const comment = await ProjectComment.create({
            project_id,
            user_id: req.user._id,
            content,
            mentions: mentions?.map(m => m.id) || []
        });

        const populated = await ProjectComment.findById(comment._id)
            .populate('user_id', 'name avatar_url');

        res.status(201).json({ 
            done: true, 
            body: {
                ...populated.toObject(),
                id: populated._id,
                created_by: populated.user_id?.name,
                created_at: populated.created_at
            } 
        });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to create project comment' });
    }
});

// GET /api/project-comments/project-members/:projectId
router.get('/project-members/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const members = await ProjectMember.find({ project_id: projectId, is_active: true })
            .populate('user_id', 'name email avatar_url');
        
        const formatted = members.map(m => ({
            id: m.user_id?._id,
            name: m.user_id?.name,
            avatar_url: m.user_id?.avatar_url
        })).filter(m => m.id);

        res.json({ done: true, body: formatted });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to fetch mention members' });
    }
});

// GET /api/project-comments/project-comments/:projectId
router.get('/project-comments/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const comments = await ProjectComment.find({ project_id: projectId })
            .sort({ created_at: 1 })
            .populate('user_id', 'name avatar_url');

        const formatted = comments.map(c => ({
            ...c.toObject(),
            id: c._id,
            created_by: c.user_id?.name,
            created_at: c.created_at
        }));

        res.json({ done: true, body: formatted });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to fetch project comments' });
    }
});

// DELETE /api/project-comments/delete/:commentId
router.delete('/delete/:commentId', async (req, res) => {
    try {
        const comment = await ProjectComment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ done: false, message: 'Comment not found' });
        
        if (comment.user_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ done: false, message: 'Not authorized' });
        }

        await ProjectComment.deleteOne({ _id: comment._id });
        res.json({ done: true });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to delete comment' });
    }
});

module.exports = router;

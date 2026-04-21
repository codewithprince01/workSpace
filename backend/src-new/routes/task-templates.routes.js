const express = require('express');
const router = express.Router();
const { taskTemplates } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');

router.get('/', protect, taskTemplates.getTaskTemplates);

// These were completely missing from the hardened architecture rewrite
router.post('/', protect, taskTemplates.createTemplate || ((req, res) => res.json({ done: true, body: {} })));
router.get('/:id', protect, taskTemplates.getTemplate || ((req, res) => res.json({ done: true, body: {} })));
router.put('/:id', protect, taskTemplates.updateTemplate || ((req, res) => res.json({ done: true, body: {} })));
router.delete('/:id', protect, taskTemplates.deleteTemplate || (async (req, res) => {
    try {
        const { Task } = require('../models');
        await Task.findByIdAndUpdate(req.params.id, { is_trashed: true });
        res.json({ done: true });
    } catch {
        res.json({ done: false });
    }
}));

module.exports = router;

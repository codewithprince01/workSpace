const express = require('express');
const router = express.Router();
const { tasks } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');
const { commonValidators } = require('../middlewares/validation.middleware');

router.use(protect);

// Stub for task dependencies
router.get('/:taskId', commonValidators.mongoIdParam('taskId'), async (req, res, next) => {
    res.json({ done: true, body: [] });
});

router.post('/', async (req, res, next) => {
    res.json({ done: true, body: req.body });
});

router.delete('/:id', commonValidators.mongoId, async (req, res, next) => {
    res.json({ done: true });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Apply protection to all routes
router.use(protect);

// GET /api/task-priorities - Get task priorities
router.get('/', async (req, res) => {
  try {
    res.json({
      done: true,
      body: [
        { id: 'low', name: 'Low', color_code: '#87d068', value: 0 },
        { id: 'medium', name: 'Medium', color_code: '#2db7f5', value: 1 },
        { id: 'high', name: 'High', color_code: '#ff9800', value: 2 },
        { id: 'urgent', name: 'Urgent', color_code: '#f50', value: 3 }
      ]
    });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch task priorities' });
  }
});

module.exports = router;

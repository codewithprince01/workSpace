const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Apply protection to all routes
router.use(protect);

// GET /api/project-healths - Get all project health options
router.get('/', async (req, res) => {
  try {
    res.json({
      done: true,
      body: [
        { id: '1', name: 'On Track', color_code: '#52c41a' },
        { id: '2', name: 'At Risk', color_code: '#faad14' },
        { id: '3', name: 'Off Track', color_code: '#ff4d4f' }
      ]
    });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch project health options' });
  }
});

module.exports = router;

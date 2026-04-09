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
        { id: 'not_set', name: 'Not Set', color_code: '#a3a3a3' },
        { id: 'needs_attention', name: 'Needs Attention', color_code: '#f4c542' },
        { id: 'at_risk', name: 'At Risk', color_code: '#ff6b6b' },
        { id: 'good', name: 'Good', color_code: '#73d39a', is_default: true }
      ]
    });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch project health options' });
  }
});

module.exports = router;

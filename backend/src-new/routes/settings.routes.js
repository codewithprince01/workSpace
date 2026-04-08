const express = require('express');
const router = express.Router();
const { settings } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/setup', settings.setupAccount);

// GET /api/settings/notifications - Get notification settings
router.get('/notifications', async (req, res) => {
  try {
    res.json({
      done: true,
      body: {
        popup_notifications_enabled: true,
        email_notifications_enabled: true
      }
    });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch notification settings' });
  }
});

module.exports = router;

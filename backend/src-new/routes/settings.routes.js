const express = require('express');
const router = express.Router();
const { settings } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/setup', settings.setupAccount);

// GET /api/settings/notifications - Get notification settings
router.get('/notifications', async (req, res) => {
  try {
    const { User } = require('../models');
    const user = await User.findById(req.user._id).select('popup_notifications_enabled email_notifications_enabled daily_digest_enabled show_unread_items_count').lean();
    
    res.json({
      done: true,
      body: {
        popup_notifications_enabled: user?.popup_notifications_enabled !== undefined ? user.popup_notifications_enabled : true,
        email_notifications_enabled: user?.email_notifications_enabled !== undefined ? user.email_notifications_enabled : true,
        daily_digest_enabled: user?.daily_digest_enabled !== undefined ? user.daily_digest_enabled : true,
        show_unread_items_count: user?.show_unread_items_count !== undefined ? user.show_unread_items_count : true
      }
    });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch notification settings' });
  }
});

// PUT /api/settings/notifications - Update notification settings
router.put('/notifications', async (req, res) => {
  try {
    const { popup_notifications_enabled, email_notifications_enabled, daily_digest_enabled, show_unread_items_count } = req.body;
    
    // Update user's notification preferences in database
    const { User } = require('../models');
    const updateData = {};
    if (popup_notifications_enabled !== undefined) updateData.popup_notifications_enabled = popup_notifications_enabled;
    if (email_notifications_enabled !== undefined) updateData.email_notifications_enabled = email_notifications_enabled;
    if (daily_digest_enabled !== undefined) updateData.daily_digest_enabled = daily_digest_enabled;
    if (show_unread_items_count !== undefined) updateData.show_unread_items_count = show_unread_items_count;
    
    await User.findByIdAndUpdate(req.user._id, updateData);

    res.json({
      done: true,
      body: {
        popup_notifications_enabled: popup_notifications_enabled !== undefined ? popup_notifications_enabled : true,
        email_notifications_enabled: email_notifications_enabled !== undefined ? email_notifications_enabled : true,
        daily_digest_enabled: daily_digest_enabled !== undefined ? daily_digest_enabled : true,
        show_unread_items_count: show_unread_items_count !== undefined ? show_unread_items_count : true
      }
    });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to update notification settings' });
  }
});

module.exports = router;

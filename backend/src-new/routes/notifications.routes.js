const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { Notification } = require('../models');

// Apply protection to all routes
router.use(protect);

// GET /api/notifications - Get notifications
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.index) || 1;
    const limit = parseInt(req.query.size) || 20;
    const skip = (page - 1) * limit;

    const query = { user_id: req.user._id };
    
    // Optional: filter by read/unread
    if (req.query.read === 'false') {
        query.is_read = false;
    }

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('team_id', 'name')
        .populate('project_id', 'name')
        .populate('user_id', 'name avatar_url'); // sender/actor info if we stored it? Schema only has 'user_id' as recipient.
    
    // NOTE: The schema has user_id as the recipient.
    // If we want to show WHO triggered it, we might need a 'sender_id' or include it in the message. 
    // Schema doesn't have sender_id. We'll rely on message content for now.

    res.json({
      done: true,
      body: {
          data: notifications,
          total: total
      }
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:id - Mark notification as read
router.put('/:id', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user_id: req.user._id },
        { is_read: true },
        { new: true }
    );
    res.json({ done: true, body: notification });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to update notification' });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all/update', async (req, res) => { // Frontend might call /read-all or /read-all/update? The stub was /read-all
  // Let's support both if needed, but standard REST usually implies an action.
  // The stub had '/read-all'.
  try {
    await Notification.updateMany(
        { user_id: req.user._id, is_read: false },
        { is_read: true }
    );
    res.json({ done: true });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to mark all as read' });
  }
});

// Match the original stub path exactly for safety
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
        { user_id: req.user._id, is_read: false },
        { is_read: true }
    );
    res.json({ done: true });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to mark all as read' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ user_id: req.user._id, is_read: false });
    res.json({ done: true, body: unreadCount });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch unread count' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { Notification } = require('../models');

// Apply protection to all routes
router.use(protect);

// ── GET ROUTES ────────────────────────────────────────────────

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ user_id: req.user._id, is_read: false });
    res.json({ done: true, body: unreadCount });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch unread count' });
  }
});

// GET /api/notifications - Get notifications (paginated)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.index) || 1;
    const limit = parseInt(req.query.size) || 20;
    const skip = (page - 1) * limit;

    const query = { user_id: req.user._id };
    
    // Support frontend filter values: 'Unread' or 'Read'
    if (req.query.filter === 'Unread') {
        query.is_read = false;
    } else if (req.query.filter === 'Read') {
        query.is_read = true;
    }
    
    // Legacy support for ?read=false
    if (req.query.read === 'false') {
        query.is_read = false;
    }

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('team_id', 'name')
        .populate('project_id', 'name color_code team_id')
        .populate('user_id', 'name avatar_url');

    const mappedNotifications = notifications.map(n => {
      const id = n._id?.toString?.() || n.id;
      const projectId = n.project_id?._id?.toString?.() || n.project_id?.toString?.();
      const taskId = n.task_id?._id?.toString?.() || n.task_id?.toString?.();
      const teamIdFromTeam = n.team_id?._id?.toString?.() || n.team_id?.toString?.();
      const teamIdFromProject = n.project_id?.team_id?.toString?.();
      const teamId = teamIdFromTeam || teamIdFromProject || '';

      return {
        id,
        team: n.team_id?.name || n.meta?.team_name || 'Worklenz',
        team_id: teamId,
        message: n.message,
        project: n.project_id?.name || n.meta?.project_name || '',
        color: n.project_id?.color_code || '#1890ff',
        url: projectId ? `/workspace/projects/${projectId}` : '',
        task_id: taskId || '',
        params: {
          tab: 'tasks-list',
          pinned_tab: 'tasks-list',
          ...(taskId ? { task: taskId } : {}),
        },
        created_at: n.created_at,
        type: n.type,
      };
    });
    
    res.json({
      done: true,
      body: {
          data: mappedNotifications,
          total: total
      }
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch notifications' });
  }
});

// ── PUT ROUTES ────────────────────────────────────────────────

// IMPORTANT: Static paths must come BEFORE parameterized ones (:id)
// otherwise /read-all will be treated as an ID and cause a CastError.

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
        { user_id: req.user._id, is_read: false },
        { is_read: true }
    );
    res.json({ done: true });
  } catch (error) {
    console.error('Read-all error:', error);
    res.status(500).json({ done: false, message: 'Failed to mark all as read' });
  }
});

// PUT /api/notifications/read-all/update (Alias support)
router.put('/read-all/update', async (req, res) => {
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

// PUT /api/notifications/:id - Mark single notification as read
router.put('/:id', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user_id: req.user._id },
        { is_read: true },
        { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ done: false, message: 'Notification not found' });
    }

    res.json({ done: true, body: notification });
  } catch (error) {
    console.error('Update notification error:', error);
    res.status(500).json({ done: false, message: 'Failed to update notification' });
  }
});

module.exports = router;

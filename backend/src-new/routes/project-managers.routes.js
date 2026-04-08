const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', async (req, res) => {
    try {
        // For now, return all active users as potential managers
        const users = await User.find({ is_active: true }).select('name email avatar_url');
        res.json({
            done: true,
            body: users.map(u => ({
                id: u._id,
                name: u.name,
                email: u.email,
                avatar_url: u.avatar_url
            }))
        });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to fetch project managers' });
    }
});

module.exports = router;

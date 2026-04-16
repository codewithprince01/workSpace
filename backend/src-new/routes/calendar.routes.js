const express = require('express');
const router = express.Router();
const calendar = require('../controllers/calendar.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

// Events CRUD
router.get('/events', calendar.getEvents);
router.get('/events/:id', calendar.getEvent);
router.post('/events', calendar.createEvent);
router.put('/events/:id', calendar.updateEvent);
router.delete('/events/:id', calendar.deleteEvent);

// Mood
router.get('/moods', calendar.getTeamMoods);

// Team members (for assignment dropdowns)
router.get('/team-members', calendar.getTeamMembers);

module.exports = router;

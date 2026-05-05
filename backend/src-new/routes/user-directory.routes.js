const express = require('express');
const router = express.Router();
const userDirectory = require('../controllers/user-directory.controller');
const { protect } = require('../middlewares/auth.middleware');

// Public search for all authenticated users (used for inviting team members)
router.use(protect);

router.get('/',        userDirectory.listUsers);
router.get('/search', userDirectory.searchUsers);

module.exports = router;

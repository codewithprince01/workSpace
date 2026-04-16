const express = require('express');
const router = express.Router();
const { taskTemplates } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');

router.get('/', protect, taskTemplates.getTaskTemplates);

module.exports = router;

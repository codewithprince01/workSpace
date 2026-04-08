const express = require('express');
const router = express.Router();
const controller = require('../controllers/task-phases.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', controller.getAll);

module.exports = router;

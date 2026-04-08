const express = require('express');
const router = express.Router();
const { projectTemplates } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');

router.get('/worklenz-templates', projectTemplates.getWorklenzTemplates);
router.get('/worklenz-templates/:id', projectTemplates.getWorklenzTemplateById);

router.post('/setup', protect, projectTemplates.setupAccountWithTemplate);

module.exports = router;

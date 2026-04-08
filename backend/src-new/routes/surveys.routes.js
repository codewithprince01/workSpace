const express = require('express');
const router = express.Router();
const { surveys } = require('../controllers');

// Public survey endpoints for account setup
router.get('/account-setup', surveys.getAccountSetupSurvey);
router.get('/account-setup/status', surveys.getAccountSetupSurveyStatus);
router.get('/responses/:surveyId', surveys.getSurveyResponse);
router.post('/responses', surveys.submitSurveyResponse);

module.exports = router;

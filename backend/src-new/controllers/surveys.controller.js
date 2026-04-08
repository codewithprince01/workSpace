const { v4: uuidv4 } = require('uuid');

/**
 * @desc    Get account setup survey
 * @route   GET /api/surveys/account-setup
 * @access  Public
 */
exports.getAccountSetupSurvey = async (req, res) => {
  return res.json({
    done: true,
    body: {
      id: 'account-setup-default',
      name: 'Account Setup Survey',
      survey_type: 'account_setup',
      is_active: true,
      questions: []
    }
  });
};

/**
 * @desc    Submit survey response
 * @route   POST /api/surveys/responses
 * @access  Public
 */
exports.submitSurveyResponse = async (req, res) => {
  return res.json({
    done: true,
    body: {
      response_id: uuidv4()
    }
  });
};

/**
 * @desc    Get user survey response
 * @route   GET /api/surveys/responses/:surveyId
 * @access  Public
 */
exports.getSurveyResponse = async (req, res) => {
  return res.json({
    done: true,
    body: {
      survey_id: req.params.surveyId,
      is_completed: false,
      answers: []
    }
  });
};

/**
 * @desc    Check account setup survey status
 * @route   GET /api/surveys/account-setup/status
 * @access  Public
 */
exports.getAccountSetupSurveyStatus = async (req, res) => {
  return res.json({
    done: true,
    body: {
      is_completed: false
    }
  });
};

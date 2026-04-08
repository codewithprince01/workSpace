const { v4: uuidv4 } = require('uuid');

/**
 * @desc    Get worklenz templates
 * @route   GET /api/project-templates/worklenz-templates
 * @access  Public
 */
exports.getWorklenzTemplates = async (req, res) => {
  return res.json({
    done: true,
    body: []
  });
};

/**
 * @desc    Get template by id
 * @route   GET /api/project-templates/worklenz-templates/:id
 * @access  Public
 */
exports.getWorklenzTemplateById = async (req, res) => {
  return res.json({
    done: true,
    body: {
      id: req.params.id,
      name: 'Template',
      description: '',
      tasks: []
    }
  });
};

/**
 * @desc    Setup account with template
 * @route   POST /api/project-templates/setup
 * @access  Private
 */
exports.setupAccountWithTemplate = async (req, res) => {
  return res.json({
    done: true,
    body: {
      id: uuidv4(),
      has_invitations: false
    }
  });
};

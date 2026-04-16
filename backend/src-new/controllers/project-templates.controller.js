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
 * @desc    Get custom templates
 * @route   GET /api/project-templates/custom-templates
 * @access  Private
 */
exports.getCustomTemplates = async (req, res) => {
  try {
    const { Project, TeamMember } = require('../models');
    
    // Find user's team
    let teamId = req.query.team_id;
    if (!teamId) {
       const member = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
       teamId = member?.team_id;
    }

    if (!teamId) {
        return res.json({ done: true, body: [] });
    }

    // Find projects that are marked as templates
    const templates = await Project.find({ 
      team_id: teamId, 
      is_template: true,
      is_archived: false 
    });
    
    // Normalize output to match frontend expectations
    const normalizedTemplates = templates.map(template => ({
      id: String(template._id),
      name: template.name || '',
      description: template.description || '',
      color_code: template.color_code || '#1890ff',
      team_id: template.team_id ? String(template.team_id) : null,
      is_template: template.is_template || false
    }));
    
    res.json({
      done: true,
      body: normalizedTemplates
    });
  } catch (error) {
    console.error('Get custom templates error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch custom templates' });
  }
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

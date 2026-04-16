/**
 * @desc    Get task templates
 * @route   GET /api/task-templates
 * @access  Private
 */
exports.getTaskTemplates = async (req, res) => {
  try {
    const { Task, TeamMember } = require('../models');
    
    // Find user's team
    let teamId = req.query.team_id;
    if (!teamId) {
       const member = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
       teamId = member?.team_id;
    }

    if (!teamId) {
        return res.json({ done: true, body: [] });
    }

    // Find tasks that are marked as templates
    const templates = await Task.find({ 
      team_id: teamId, 
      is_template: true,
      is_trashed: false,
      is_archived: false 
    });
    
    // Normalize output to match frontend expectations
    const normalizedTemplates = templates.map(template => ({
      id: String(template._id),
      name: template.name || '',
      description: template.description || '',
      project_id: template.project_id ? String(template.project_id) : null,
      team_id: template.team_id ? String(template.team_id) : null,
      is_template: template.is_template || false
    }));
    
    res.json({
      done: true,
      body: normalizedTemplates
    });
  } catch (error) {
    console.error('Get task templates error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch task templates' });
  }
};

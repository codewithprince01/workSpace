const { Team, User, Project, AuditLog, Task } = require('../models');
const { logSuperAdminAction } = require('../middlewares/audit.middleware');

/**
 * @desc    Get all teams in the system (super admin only)
 * @route   GET /api/super-admin/teams
 * @access  Super Admin
 */
exports.getAllTeams = async (req, res, next) => {
  try {
    const teams = await Team.find({ is_active: true })
      .populate('owner_id', 'name email avatar_url')
      .sort({ created_at: -1 })
      .lean();

    const formatted = teams
      .filter(t => t.owner_id) // Skip teams with deleted owners
      .map(t => ({
        id: t._id.toString(),
        name: t.name,
        color_code: t.color_code,
        created_at: t.created_at,
        owner_name: t.owner_id?.name || 'Unknown',
        owner_email: t.owner_id?.email || '',
        owner_avatar: t.owner_id?.avatar_url || null,
      }));

    // Log access
    await logSuperAdminAction({
      superAdmin: req.user,
      action: 'VIEW_ALL_TEAMS',
      mode: req.user.super_admin_manage_mode ? 'manage' : 'view',
      ip: req.ip
    });

    res.json({ done: true, body: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Switch super admin into any organization context
 * @route   POST /api/super-admin/switch-org
 * @access  Super Admin
 * Body: { team_id: string }
 */
exports.switchOrg = async (req, res, next) => {
  try {
    const { team_id } = req.body;

    if (!team_id) {
      return res.status(400).json({ done: false, message: 'team_id is required' });
    }

    const team = await Team.findById(team_id);
    if (!team) {
      return res.status(404).json({ done: false, message: 'Team not found' });
    }

    // Update super admin's active team context (does NOT change their own team)
    // By default, set manage_mode to true so they can edit immediately
    await User.findByIdAndUpdate(req.user._id, {
      super_admin_active_team: team_id,
      super_admin_manage_mode: true
    });

    await logSuperAdminAction({
      superAdmin: req.user,
      teamId: team._id,
      teamName: team.name,
      action: 'SWITCH_ORG',
      mode: req.user.super_admin_manage_mode ? 'manage' : 'view',
      ip: req.ip
    });

    res.json({
      done: true,
      body: {
        active_team_id: team._id.toString(),
        active_team_name: team.name
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Exit org context (return to own team)
 * @route   POST /api/super-admin/exit-org
 * @access  Super Admin
 */
exports.exitOrg = async (req, res, next) => {
  try {
    const prevTeam = req.user.super_admin_active_team;

    await User.findByIdAndUpdate(req.user._id, {
      super_admin_active_team: null,
      super_admin_manage_mode: false
    });

    if (prevTeam) {
      await logSuperAdminAction({
        superAdmin: req.user,
        teamId: prevTeam,
        action: 'EXIT_ORG',
        ip: req.ip
      });
    }

    res.json({ done: true, message: 'Returned to own workspace' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle manage/view mode for super admin
 * @route   POST /api/super-admin/toggle-mode
 * @access  Super Admin
 * Body: { manage_mode: boolean }
 */
exports.toggleMode = async (req, res, next) => {
  try {
    const { manage_mode } = req.body;
    const mode = !!manage_mode;

    await User.findByIdAndUpdate(req.user._id, {
      super_admin_manage_mode: mode
    });

    const activeTeam = req.user.super_admin_active_team;
    if (activeTeam) {
      await logSuperAdminAction({
        superAdmin: req.user,
        teamId: activeTeam,
        action: 'TOGGLE_MANAGE_MODE',
        mode: mode ? 'manage' : 'view',
        metadata: { manage_mode: mode },
        ip: req.ip
      });
    }

    res.json({
      done: true,
      body: { manage_mode: mode }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get super admin context (current active team + mode)
 * @route   GET /api/super-admin/context
 * @access  Super Admin
 */
exports.getContext = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('super_admin_active_team', 'name color_code')
      .lean();

    const activeTeam = user.super_admin_active_team;

    res.json({
      done: true,
      body: {
        is_super_admin: true,
        active_team_id: activeTeam?._id?.toString() || null,
        active_team_name: activeTeam?.name || null,
        active_team_color: activeTeam?.color_code || null,
        own_team_id: user.last_team_id?.toString() || null,
        manage_mode: user.super_admin_manage_mode || false
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get audit logs (super admin only)
 * @route   GET /api/super-admin/audit-logs
 * @access  Super Admin
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.team_id) query.target_team_id = req.query.team_id;
    if (req.query.action) query.action = req.query.action;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('target_team_id', 'name')
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      done: true,
      body: logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all users in system (super admin overview)
 * @route   GET /api/super-admin/users
 * @access  Super Admin
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({})
        .select('-password -password_reset_token -password_reset_expires')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments()
    ]);

    await logSuperAdminAction({
      superAdmin: req.user,
      action: 'VIEW_ALL_USERS',
      ip: req.ip
    });

    res.json({ done: true, body: users, total });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Promote/demote user to super_admin
 * @route   PUT /api/super-admin/users/:userId/role
 * @access  Super Admin
 * Body: { role: 'user' | 'super_admin' }
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!['user', 'super_admin'].includes(role)) {
      return res.status(400).json({ done: false, message: 'Invalid role. Must be user or super_admin.' });
    }

    // Prevent self-demotion
    if (req.params.userId === req.user._id.toString() && role === 'user') {
      return res.status(400).json({ done: false, message: 'Cannot demote yourself.' });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.userId,
      { role },
      { new: true }
    ).select('-password');

    if (!updated) {
      return res.status(404).json({ done: false, message: 'User not found' });
    }

    await logSuperAdminAction({
      superAdmin: req.user,
      action: 'UPDATE_USER_ROLE',
      resourceType: 'user',
      resourceId: updated._id,
      resourceName: updated.name,
      metadata: { new_role: role },
      ip: req.ip
    });

    res.json({ done: true, body: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get ALL projects across ALL teams (super admin global view)
 * @route   GET /api/super-admin/projects
 * @access  Super Admin
 */
exports.getAllProjects = async (req, res, next) => {
  try {
    const { search, team_id, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let matchQuery = {};
    if (team_id) {
      const mongoose = require('mongoose');
      matchQuery.team_id = new mongoose.Types.ObjectId(team_id);
    }
    if (search) matchQuery.name = { $regex: search, $options: 'i' };

    const [projects, total] = await Promise.all([
      Project.find(matchQuery)
        .populate('team_id', 'name color_code')
        .populate('owner_id', 'name email avatar_url')   // correct field: owner_id
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Project.countDocuments(matchQuery)
    ]);

    // Get task counts per project
    const projectIds = projects.map(p => p._id);
    const taskCounts = await Task.aggregate([
      { $match: { project_id: { $in: projectIds }, is_trashed: { $ne: true } } },
      { $group: { _id: '$project_id', count: { $sum: 1 } } }
    ]);
    const taskCountMap = {};
    taskCounts.forEach(t => { taskCountMap[t._id.toString()] = t.count; });

    const formatted = projects
      .filter(p => p.owner_id) // Skip projects with deleted owners
      .map(p => ({
        id: p._id.toString(),
        name: p.name,
        color_code: p.color_code || '#1890ff',
        status: p.status || 'active',
        created_at: p.created_at,
        team_id: p.team_id?._id?.toString() || null,
        team_name: p.team_id?.name || 'Unknown',
        team_color: p.team_id?.color_code || '#6366f1',
        owner_name: p.owner_id?.name || 'Unknown',
        owner_email: p.owner_id?.email || '',
        owner_avatar: p.owner_id?.avatar_url || null,
        total_tasks: taskCountMap[p._id.toString()] || 0,
      }));

    res.json({ done: true, body: formatted, total: parseInt(total), page: parseInt(page) });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get tasks for a specific project (super admin, with optional today filter)
 * @route   GET /api/super-admin/projects/:projectId/tasks
 * @access  Super Admin
 * @query   today=true  - return only tasks due today
 */
exports.getProjectTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { today } = req.query;
    const mongoose = require('mongoose');

    let query = {
      project_id: new mongoose.Types.ObjectId(projectId),
      is_trashed: { $ne: true },
    };

    if (today === 'true') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      query.due_date = { $gte: start, $lte: end };
    }

    const tasks = await Task.find(query)
      .populate('assignees', 'name email avatar_url')
      .populate('status_id', 'name color_code')   // correct: status_id
      .sort({ created_at: -1 })
      .lean();

    const formatted = tasks.map(t => ({
      id: t._id.toString(),
      name: t.name || 'Untitled',
      status: t.status_id?.name || 'To Do',
      status_color: t.status_id?.color_code || '#8c8c8c',
      priority: t.priority || 'medium',
      progress: t.progress || 0,
      due_date: t.due_date || null,
      start_date: t.start_date || null,
      created_at: t.created_at,
      completed_at: t.completed_at || null,
      assignees: (t.assignees || []).map(a => ({
        id: a._id,
        name: a.name,
        email: a.email,
        avatar: a.avatar_url
      })),
    }));

    res.json({ done: true, body: formatted });
  } catch (error) {
    next(error);
  }
};

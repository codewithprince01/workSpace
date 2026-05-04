const { Team, User, Project, AuditLog } = require('../models');
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

    const formatted = teams.map(t => ({
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
    await User.findByIdAndUpdate(req.user._id, {
      super_admin_active_team: team_id
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

const { Team, TeamMember, User, ProjectMember, Project, Notification } = require('../models');

/**
 * @desc    Create team
 * @route   POST /api/teams
 * @access  Private
 */
exports.create = async (req, res, next) => {
  try {
    const { name, color_code } = req.body;
    
    // Check for duplicate name
    const existing = await Team.findOne({ owner_id: req.user._id, name });
    if (existing) {
      return res.status(400).json({
        done: false,
        message: 'Team name already exists'
      });
    }
    
    const team = await Team.create({
      name,
      owner_id: req.user._id,
      color_code
    });
    
    // Add creator as team member
    await TeamMember.create({
      team_id: team._id,
      user_id: req.user._id,
      role: 'owner'
    });
    
    res.status(201).json({
      done: true,
      body: team
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all teams for user
 * @route   GET /api/teams
 * @access  Private
 */
exports.getAll = async (req, res, next) => {
  try {
    // Get teams where user is a member
    const memberships = await TeamMember.find({ user_id: req.user._id, is_active: true });
    
    let teamIds = [];
    if (Array.isArray(memberships)) {
        teamIds = memberships.map(m => m.team_id ? m.team_id.toString() : null).filter(Boolean);
    }
    
    // IMPORTANT: Only show teams where the user has active team membership.
    // Do not infer teams from project memberships to avoid "auto-joined" behavior in navbar.
    
    const teams = await Team.find({ _id: { $in: teamIds }, is_active: true })
      .populate('owner_id', 'name email avatar_url');
    
    // Map teams to include 'id' and 'owns_by' for frontend compatibility
    const formattedTeams = teams.map(team => ({
      ...team.toObject(),
      id: team._id.toString(),
      owns_by: team.owner_id?.name || 'Unknown'
    }));
    
    res.json({
      done: true,
      body: formattedTeams
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pending team invitations for current user
 * @route   GET /api/teams/invites
 * @access  Private
 */
exports.getInvites = async (req, res, next) => {
  try {
    const pendingInvites = await TeamMember.find({
      user_id: req.user._id,
      pending_invitation: true,
      is_active: false,
    })
      .populate('team_id', 'name owner_id')
      .lean();

    const teamIds = pendingInvites
      .map(invite => invite.team_id?._id || invite.team_id)
      .filter(Boolean);

    const unreadNotifications = await Notification.find({
      user_id: req.user._id,
      type: 'team_invite',
      team_id: { $in: teamIds },
      is_read: false,
    })
      .sort({ created_at: -1 })
      .lean();

    const notificationByTeam = new Map();
    unreadNotifications.forEach(notification => {
      const teamId = notification.team_id?.toString();
      if (teamId && !notificationByTeam.has(teamId)) {
        notificationByTeam.set(teamId, notification);
      }
    });

    const ownerIds = pendingInvites
      .map(invite => invite.team_id?.owner_id)
      .filter(Boolean);
    const owners = await User.find({ _id: { $in: ownerIds } }).select('name').lean();
    const ownerNameById = new Map(owners.map(owner => [owner._id.toString(), owner.name]));

    const body = pendingInvites
      .map(invite => {
        const team = invite.team_id;
        const teamId = team?._id?.toString() || team?.toString();
        if (!teamId) return null;

        const notification = notificationByTeam.get(teamId);
        if (!notification) {
          // If invite is already read, hide it from unread invitation list.
          return null;
        }

        return {
          id: invite._id.toString(),
          team_id: teamId,
          team_member_id: invite._id.toString(),
          team_name: team.name,
          team_owner: team.owner_id ? ownerNameById.get(team.owner_id.toString()) || '' : '',
          notification_id: notification._id.toString(),
        };
      })
      .filter(Boolean);

    return res.json({ done: true, body });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept team invitation
 * @route   PUT /api/teams
 * @access  Private
 */
exports.acceptInvitation = async (req, res, next) => {
  try {
    const { team_member_id } = req.body;

    if (!team_member_id) {
      return res.status(400).json({ done: false, message: 'team_member_id is required' });
    }

    const membership = await TeamMember.findOne({
      _id: team_member_id,
      user_id: req.user._id,
      pending_invitation: true,
    });

    if (!membership) {
      return res.status(404).json({ done: false, message: 'Invitation not found' });
    }

    membership.is_active = true;
    membership.pending_invitation = false;
    membership.joined_at = new Date();
    await membership.save();

    await User.findByIdAndUpdate(req.user._id, { last_team_id: membership.team_id });

    await Notification.updateMany(
      {
        user_id: req.user._id,
        team_id: membership.team_id,
        type: 'team_invite',
        is_read: false,
      },
      { is_read: true }
    );

    return res.json({
      done: true,
      body: {
        id: membership.team_id.toString(),
        team_id: membership.team_id.toString(),
        team_member_id: membership._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single team
 * @route   GET /api/teams/:id
 * @access  Private
 */
exports.getById = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('owner_id', 'name email avatar_url');
    
    if (!team) {
      return res.status(404).json({
        done: false,
        message: 'Team not found'
      });
    }
    
    // Get members
    const members = await TeamMember.find({ team_id: team._id, is_active: true })
      .populate('user_id', 'name email avatar_url');
    
    res.json({
      done: true,
      body: {
        ...team.toObject(),
        members: members.map(m => ({
          ...m.user_id.toObject(),
          role: m.role,
          job_title: m.job_title
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update team
 * @route   PUT /api/teams/:id
 * @access  Private
 */
exports.update = async (req, res, next) => {
  try {
    const { name, color_code } = req.body;
    
    const team = await Team.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({
        done: false,
        message: 'Team not found'
      });
    }
    
    if (name) team.name = name;
    if (color_code) team.color_code = color_code;
    
    await team.save();
    
    res.json({
      done: true,
      body: team
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add member to team
 * @route   POST /api/teams/:id/members
 * @access  Private
 */
exports.addMember = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        done: false,
        message: 'User not found'
      });
    }
    
    // Check if already member
    const existing = await TeamMember.findOne({ 
      team_id: req.params.id, 
      user_id: user._id 
    });
    
    if (existing) {
      return res.status(400).json({
        done: false,
        message: 'User is already a team member'
      });
    }
    
    const member = await TeamMember.create({
      team_id: req.params.id,
      user_id: user._id,
      role: role || 'member'
    });
    
    res.status(201).json({
      done: true,
      body: {
        ...user.toObject(),
        role: member.role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove member from team
 * @route   DELETE /api/teams/:id/members/:userId
 * @access  Private
 */
exports.removeMember = async (req, res, next) => {
  try {
    await TeamMember.findOneAndUpdate(
      { team_id: req.params.id, user_id: req.params.userId },
      { is_active: false }
    );
    
    res.json({
      done: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update member role
 * @route   PUT /api/teams/:id/members/:userId
 * @access  Private
 */
exports.updateMemberRole = async (req, res, next) => {
  try {
    const { role } = req.body; // 'admin' or 'member'
    
    // Update TeamMember
    const member = await TeamMember.findOneAndUpdate(
      { team_id: req.params.id, user_id: req.params.userId },
      { role }, // e.g. 'admin', 'member', 'owner'
      { new: true }
    );
    
    if (!member) {
      return res.status(404).json({
        done: false,
        message: 'Team member not found'
      });
    }

    // Sync with User model is_admin flag
    if (role === 'admin' || role === 'owner') {
      await User.findByIdAndUpdate(req.params.userId, { is_admin: true });
    } else {
      await User.findByIdAndUpdate(req.params.userId, { is_admin: false });
    }
    
    res.json({
      done: true,
      body: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Activate team
 * @route   PUT /api/teams/activate
 * @access  Private
 */
exports.activate = async (req, res, next) => {
  try {
    const { id } = req.body;
    
    console.log('🔄 [ACTIVATE] Request received:', { teamId: id, userId: req.user._id });
    
    // Validate team exists and user is a member (either direct or via project)
    const teamFn = require('../models/Team');
    const teamMemberFn = require('../models/TeamMember');
    const projectMemberFn = require('../models/ProjectMember');
    const projectFn = require('../models/Project'); // Add Project model
    
    // 1. Direct membership check
    const membership = await teamMemberFn.findOne({ team_id: id, user_id: req.user._id, is_active: true });
    console.log('🔄 [ACTIVATE] Direct membership:', !!membership);
    
    let hasAccess = !!membership;
    
    // 2. If not direct member, check project membership for projects in this team
    if (!hasAccess) {
        const projectMemberships = await projectMemberFn.find({ user_id: req.user._id, is_active: true });
        const projectIds = projectMemberships.map(pm => pm.project_id);
        
        if (projectIds.length > 0) {
            // Check if any of these projects belong to the target team
            const validProject = await projectFn.findOne({ 
                _id: { $in: projectIds },
                team_id: id 
            });
            
            if (validProject) hasAccess = true;
        }
    }
    
    if (!hasAccess) {
      console.log('❌ [ACTIVATE] Access denied');
      return res.status(403).json({
        done: false,
        message: 'You do not have access to this team'
      });
    }
    
    console.log('✅ [ACTIVATE] Access granted, updating last_team_id');
    
    // Update user's last_team_id
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id, 
      { last_team_id: id },
      { new: true }
    );
    
    console.log('✅ [ACTIVATE] Updated user last_team_id:', updatedUser.last_team_id);
    
    // Get user's team role to return in response
    const teamMember = await teamMemberFn.findOne({
      team_id: id,
      user_id: req.user._id,
      is_active: true
    });
    
    res.json({
      done: true,
      body: {
        team_id: id,
        team_role: teamMember?.role || 'member'
      }
    });
  } catch (error) {
    next(error);
  }
};

const { ProjectMember, User, TeamMember, Project, ProjectInvitation } = require('../models');
const emailService = require('../services/email.service');
const crypto = require('crypto');

/**
 * @desc    Add member to project
 * @route   POST /api/project-members
 * @access  Private (Admin only)
 */
exports.create = async (req, res, next) => {
  try {
    console.log('🚀 [ADD-MEMBER] STARTING MEMBER ADDITION');
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    console.log('❓ Query:', JSON.stringify(req.query, null, 2));
    
    const { user_id, team_member_id, role } = req.body;
    let { project_id } = req.body;
    if (!project_id) project_id = req.query.current_project_id || req.query.project_id;
    let targetUserId = user_id;

    // Resolve user_id if not explicitly provided
    const mongoose = require('mongoose');
    const isValidId = (id) => id && mongoose.Types.ObjectId.isValid(id);
    if (!targetUserId && isValidId(team_member_id)) {
      console.log(`🔍 Resolving user_id from team_member_id: ${team_member_id}`);
      
      // Try finding as TeamMember
      const teamMember = await TeamMember.findById(team_member_id);
      if (teamMember) {
        targetUserId = teamMember.user_id;
        console.log('✅ Resolved via TeamMember. user_id:', targetUserId);
      } else {
        console.log('⚠️ Not found as TeamMember. Checking if it is a User ID...');
        // Fallback: Check if the ID itself is a User ID
        const user = await User.findById(team_member_id);
        if (user) {
          targetUserId = team_member_id;
          console.log('✅ Resolved as User ID (fallback). user_id:', targetUserId);
        } else {
          console.log('❌ UNABLE TO RESOLVE ID:', team_member_id);
        }
      }
    }

    if (!targetUserId) {
      console.error('❌ FAILED: Missing targetUserId. Request details:', {
        body: req.body,
        query: req.query
      });
      return res.status(400).json({ 
        done: false, 
        message: 'Unable to add member: Missing user or project ID.', 
        debug: { team_member_id, user_id } 
      });
    }

    // Role Logic
    let assignedRole = role || 'member';
    if (!['member', 'viewer', 'admin'].includes(assignedRole)) {
      assignedRole = 'member';
    }

    // Only owners AND admins can assign admin role (owners can; admins can too)
    const isAdminOrOwner = req.isProjectOwner || req.projectRole === 'admin';
    if (assignedRole === 'admin' && !isAdminOrOwner) {
      console.log('⚠️ Non-admin tried to assign ADMIN role. Downgrading to member.');
      assignedRole = 'member';
    }
    
    // Check if exists
    const existing = await ProjectMember.findOne({ project_id, user_id: targetUserId });
    if (existing) {
         if (!existing.is_active) {
            existing.is_active = true;
            existing.role = assignedRole;
            await existing.save();
            await existing.populate('user_id', 'name email avatar_url');
            
            const response = {
              id: existing._id,
              team_member_id: team_member_id,
              name: existing.user_id?.name,
              email: existing.user_id?.email,
              avatar_url: existing.user_id?.avatar_url,
              role: existing.role
            };
            return res.json({ done: true, body: response });
         }
         console.log('❌ [ADD-MEMBER] User already exists as active member');
         return res.status(409).json({ done: false, message: 'User is already a project member' });
    }
    
    console.log('✅ [ADD-MEMBER] Creating new project member');
    const member = await ProjectMember.create({
        project_id,
        user_id: targetUserId,
        role: assignedRole
    });
    
    await member.populate('user_id', 'name email avatar_url');
    
    const response = {
      id: member._id,
      team_member_id: team_member_id,
      name: member.user_id?.name,
      email: member.user_id?.email,
      avatar_url: member.user_id?.avatar_url,
      role: member.role
    };
    
    console.log('✅ [ADD-MEMBER] Member added successfully:', response);

    // Send notification email
    const project = await Project.findById(project_id);
    if (project && response.email) {
      await emailService.sendProjectAdditionEmail(
        response.email,
        req.user.name,
        project.name,
        response.role
      );
    }

    res.status(201).json({ done: true, body: response });
  } catch (error) {
    console.error('❌ [ADD-MEMBER] ERROR:', error);
    next(error);
  }
};

/**
 * @desc    Invite member by email
 * @route   POST /api/project-members/invite
 * @access  Private
 */
exports.invite = async (req, res, next) => {
  try {
    const { project_id, email, role: rawRole } = req.body;
    // Resolve and validate role — default to 'member' if not provided or invalid
    const validRoles = ['member', 'admin', 'viewer'];
    const assignedRole = validRoles.includes((rawRole || '').toLowerCase())
      ? rawRole.toLowerCase()
      : 'member';

    if (!email || !project_id) {
      return res.status(400).json({ done: false, message: 'Email and project_id are required' });
    }

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        name: email.split('@')[0],
        password: crypto.randomBytes(16).toString('hex'),
        is_active: false,
        setup_completed: false
      });
      console.log(`📧 Created pending user for: ${email}`);
    }

    // Duplicate check — allow re-invite if pending/inactive
    const existing = await ProjectMember.findOne({ project_id, user_id: user._id });
    if (existing) {
      if (existing.is_active && !existing.pending_invitation) {
        return res.status(409).json({
          done: false,
          message: 'Member is already in project',
          body: { code: 'PROJECT_MEMBER_EXISTS', email: user.email },
        });
      }
      // BUG FIX: update role on re-invite
      existing.is_active = false;
      existing.pending_invitation = true;
      existing.role = assignedRole;
      await existing.save();
      console.log(`[PROJECT-INVITE] Re-invited ${user.email} as ${assignedRole}`);
    } else {
      await ProjectMember.create({
        project_id,
        user_id: user._id,
        role: assignedRole,   // BUG FIX: use assignedRole not hardcoded 'member'
        is_active: false,
        pending_invitation: true
      });
      console.log(`[PROJECT-INVITE] Created membership for ${user.email} as ${assignedRole}`);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (ProjectInvitation) {
      await ProjectInvitation.create({
        project_id,
        inviter_id: req.user._id,
        email: user.email,
        role: assignedRole,   // BUG FIX: use assignedRole not hardcoded 'member'
        token,
        expires_at: expiresAt
      });
    }

    const project = await Project.findById(project_id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/worklenz/invite/project/${token}`;

    try {
      await emailService.sendProjectInviteEmail(
        user.email,
        req.user.name,
        project?.name || 'a project',
        inviteLink,
        assignedRole   // BUG FIX: use assignedRole not hardcoded 'member'
      );
      console.log(`[PROJECT-INVITE] ✅ Email sent to ${user.email} as ${assignedRole}`);
    } catch (emailError) {
      console.error(`[PROJECT-INVITE] ❌ Email failed:`, emailError.message);
    }

    res.status(201).json({
      done: true,
      body: { id: user._id, name: user.name, email: user.email, avatar_url: user.avatar_url, pending_invitation: true, role: assignedRole },
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get members by project ID
 * @route   GET /api/project-members/:projectId
 * @access  Private
 */
exports.getByProjectId = async (req, res, next) => {
  try {
    const members = await ProjectMember.find({ project_id: req.params.projectId, is_active: true })
        .populate('user_id', 'name email avatar_url');
        
    const formattedMembers = members.map(m => ({
      id: m._id,
      team_member_id: m._id, // For compatibility with frontend
      name: m.user_id?.name,
      email: m.user_id?.email,
      avatar_url: m.user_id?.avatar_url,
      role: m.role,
      pending_invitation: m.pending_invitation
    }));
    
    res.json({ done: true, body: formattedMembers });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove project member
 * @route   DELETE /api/project-members/:id
 * @access  Private
 */
exports.delete = async (req, res, next) => {
  try {
    const member = await ProjectMember.findById(req.params.id);
    if (!member) {
        return res.status(404).json({ done: false, message: 'Member not found' });
    }
    
    member.is_active = false;
    await member.save();
    
    res.json({ done: true, body: { id: req.params.id }, message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};

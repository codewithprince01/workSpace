const { ProjectMember, User, TeamMember } = require('../models');

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
    
    // Only owners can assign admin role
    if (assignedRole === 'admin' && !req.isProjectOwner) {
       console.log('⚠️ Non-owner tried to assign ADMIN role. Downgrading to member.');
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
         console.log('Existing member details:', { 
           project_id: existing.project_id, 
           user_id: existing.user_id, 
           is_active: existing.is_active,
           role: existing.role
         });
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
    const { project_id, email } = req.body;
    
    if (!email || !project_id) {
      return res.status(400).json({ done: false, message: 'Email and project_id are required' });
    }
    
    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create a pending user (invitation)
      user = await User.create({
        email: email.toLowerCase(),
        name: email.split('@')[0], // Use email prefix as temporary name
        is_active: false, // Not activated until they accept
        pending_invitation: true
      });
      
      // TODO: Send invitation email here
      console.log(`📧 Invitation would be sent to: ${email}`);
    }
    
    // Strict duplicate check: do not allow re-invite if membership already exists
    const existing = await ProjectMember.findOne({ project_id, user_id: user._id });
    if (existing) {
      if (existing.is_active && !existing.pending_invitation) {
        return res.status(409).json({
          done: false,
          message: 'Member is already in project',
          body: { code: 'PROJECT_MEMBER_EXISTS', email: user.email },
        });
      }

      if (existing.pending_invitation || !existing.is_active) {
        return res.status(409).json({
          done: false,
          message: 'Member is already invited to project',
          body: { code: 'PROJECT_MEMBER_ALREADY_INVITED', email: user.email },
        });
      }
    }
    
    // Create project membership
    const member = await ProjectMember.create({
      project_id,
      user_id: user._id,
      role: 'member',
      is_active: false,
      pending_invitation: true
    });
    
    const response = {
      id: member._id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      pending_invitation: true
    };
    
    // TODO: Send invitation email
    console.log(`📧 Project invitation would be sent to: ${email} for project: ${project_id}`);
    
    res.status(201).json({ done: true, body: response, message: 'Invitation sent successfully' });
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

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TeamMember, User, Team, Notification, ProjectMember } = require('../models');
const emailService = require('../services/email.service');
const crypto = require('crypto');

// Apply protection to all routes
router.use(protect);

// GET /api/team-members - Get team members with pagination and search
router.get('/', async (req, res) => {
  try {
    const { 
      page,
      index, 
      pageSize,
      size, 
      search = '', 
      field = 'name', 
      order = 'asc',
      project // project-specific filter if provided
    } = req.query;

    const currentPage = parseInt(index || page || 1);
    const currentPageSize = parseInt(size || pageSize || 10);
    const skip = (currentPage - 1) * currentPageSize;
    const limit = currentPageSize;

    // 1. Identify current team ID
    let currentTeamId = req.user.last_team_id;

    if (!currentTeamId) {
      // Fallback: Find the first team membership for this user
      const membership = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
      if (membership) {
        currentTeamId = membership.team_id;
      }
    }

    if (!currentTeamId) {
      return res.json({ done: true, body: { data: [], total: 0 } });
    }

    // 2. Fetch all members and populate user details
    const teamMembers = await TeamMember.find({ 
      team_id: currentTeamId 
    })
    .populate('user_id', 'name email avatar_url last_active_at')
    .populate('manager_id', 'name')
    .lean();

    // 3. Transform and Filter
    const resultData = await Promise.all(teamMembers.map(async (m) => {
      // Calculate projects count for this user in this team
      const projects_count = await ProjectMember.countDocuments({
        user_id: m.user_id?._id || m.user_id,
        is_active: true
      });

      const isOnline = m.user_id?.last_active_at && 
        (new Date() - new Date(m.user_id.last_active_at)) < (5 * 60 * 1000);

      return {
        id: m.user_id?._id || m.user_id,
        team_member_id: m._id,
        name: m.user_id?.name || 'Invited User',
        email: m.user_id?.email || '',
        avatar_url: m.user_id?.avatar_url,
        role_name: m.role,
        job_title: m.job_title,
        projects_count: projects_count, // Total projects user is in
        active: m.is_active,
        pending_invitation: m.pending_invitation,
        is_online: !!isOnline,
        joined_at: m.joined_at,
        manager_id: m.manager_id?._id || m.manager_id,
        manager_name: m.manager_id?.name
      };
    }));

    // 4. Filter by search query
    let filteredData = resultData;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = resultData.filter(m => 
        m.name.toLowerCase().includes(searchLower) || 
        m.email.toLowerCase().includes(searchLower) ||
        (m.job_title && m.job_title.toLowerCase().includes(searchLower))
      );
    }

    // 5. Sorting
    filteredData.sort((a, b) => {
      const valA = (a[field] || '').toString().toLowerCase();
      const valB = (b[field] || '').toString().toLowerCase();
      if (order === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    // 6. Pagination
    const total = filteredData.length;
    const paginatedData = filteredData.slice(skip, skip + limit);
    res.json({
      done: true,
      body: {
        data: paginatedData,
        total: total
      }
    });
  } catch (error) {
    console.error('Fetch team members error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch team members: ' + error.message });
  }
});

/**
 * @desc    Get all team members (unified)
 * @route   GET /api/team-members/all
 * @access  Private
 */
router.get('/all', async (req, res) => {
  try {
    const { project } = req.query;

    if (project) {
        const { ProjectMember } = require('../models');
        const members = await ProjectMember.find({ 
            project_id: project, 
            is_active: true 
        }).populate('user_id', 'name email avatar_url');

        // Build a fallback map: user_id -> team_member_id for old rows where project_members.team_member_id is null
        const userIds = members
          .map(m => m?.user_id?._id)
          .filter(Boolean);
        const teamMembers = await TeamMember.find({
          user_id: { $in: userIds },
          is_active: true,
        }).select('_id user_id');
        const userToTeamMemberMap = {};
        teamMembers.forEach(tm => {
          if (tm?.user_id) {
            userToTeamMemberMap[tm.user_id.toString()] = tm._id?.toString();
          }
        });
        
        return res.json({
            done: true,
            body: members.map(m => ({
                // Keep existing id shape for compatibility, but expose team_member_id explicitly for assignee sockets
                id: m.user_id?._id,
                user_id: m.user_id?._id,
                team_member_id: m.team_member_id || userToTeamMemberMap[m.user_id?._id?.toString()] || null,
                name: m.user_id?.name,
                email: m.user_id?.email,
                avatar_url: m.user_id?.avatar_url,
                role: m.role,
                project_member_id: m._id
            })).filter(m => m.id)
        });
    }

    // Default: all team members for user's teams
    const userMemberships = await TeamMember.find({ user_id: req.user._id, is_active: true });
    const teamIds = userMemberships.map(m => m.team_id);
    
    const allMembers = await TeamMember.find({ 
      team_id: { $in: teamIds },
      is_active: true 
    }).populate('user_id', 'name email avatar_url');

    const uniqueMembersMap = new Map();
    for (const m of allMembers) {
      if (m.user_id && !uniqueMembersMap.has(m.user_id._id.toString())) {
        uniqueMembersMap.set(m.user_id._id.toString(), {
           id: m.user_id._id,
           user_id: m.user_id._id,
           team_member_id: m._id,
           name: m.user_id.name,
           email: m.user_id.email,
           avatar_url: m.user_id.avatar_url,
           role: m.role,
           team_id: m.team_id
        });
      }
    }
    
    res.json({
      done: true,
      body: Array.from(uniqueMembersMap.values())
    });
  } catch (error) {
    res.status(500).json({ done: false, message: error.message });
  }
});

// POST /api/team-members - Add/Invite team member
router.post('/', async (req, res) => {
  try {
    const { email, emails, team_id, role, job_title, is_admin } = req.body;
    
    console.log(`[INVITE] Request body:`, JSON.stringify({ email, emails, team_id, role, is_admin, job_title }));

    // Handle both single 'email' and array 'emails'
    const targetEmails = emails && Array.isArray(emails) ? emails : (email ? [email] : []);
    
    if (targetEmails.length === 0) {
       console.log('[INVITE] ERROR: No emails provided');
       return res.status(400).json({ done: false, message: 'No emails provided' });
    }
    console.log(`[INVITE] Target emails:`, targetEmails);

    // Determine the role to assign (normalize case)
    const assignedRole = (role && role.toLowerCase() === 'admin') ? 'admin' 
                       : (is_admin === true ? 'admin' : 'member');
    console.log(`[INVITE] Resolved role: "${assignedRole}" (from role="${role}", is_admin=${is_admin})`);

    // Determine target team
    let targetTeamId = team_id;
    if (!targetTeamId) {
      if (req.user?.last_team_id) {
        const activeMembership = await TeamMember.findOne({
          team_id: req.user.last_team_id,
          user_id: req.user._id,
          role: { $in: ['owner', 'admin'] },
          is_active: true,
        });
        if (activeMembership) {
          targetTeamId = activeMembership.team_id;
          console.log(`[INVITE] Team resolved from last_team_id: ${targetTeamId}`);
        }
      }

      if (!targetTeamId) {
        const myMembership = await TeamMember.findOne({
          user_id: req.user._id,
          role: { $in: ['owner', 'admin'] },
          is_active: true,
        });
        if (myMembership) {
          targetTeamId = myMembership.team_id;
          console.log(`[INVITE] Team resolved from admin membership: ${targetTeamId}`);
        }
      }

      if (!targetTeamId) {
        const anyTeam = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
        if (anyTeam) {
          targetTeamId = anyTeam.team_id;
          console.log(`[INVITE] Team resolved from any membership: ${targetTeamId}`);
        }
      }
    }
    
    if (!targetTeamId) {
       const newTeam = await Team.create({
         name: `${req.user.name}'s Team`,
         owner_id: req.user._id
       });
       await TeamMember.create({
         team_id: newTeam._id,
         user_id: req.user._id,
         role: 'owner'
       });
       targetTeamId = newTeam._id;
       console.log(`[INVITE] Created new team: ${targetTeamId}`);
    }

    const results = [];
    const errors = [];
    const isSingleInvite = targetEmails.length === 1;

    const team = await Team.findById(targetTeamId);
    const teamName = team ? team.name : 'your team';
    console.log(`[INVITE] Team: "${teamName}" (${targetTeamId})`);

    for (const mail of targetEmails) {
        try {
            console.log(`[INVITE] Processing email: ${mail}`);
            const user = await User.findOne({ email: mail.toLowerCase().trim() });
            
            let targetUser = user;

            if (!targetUser) {
                console.log(`[INVITE] ⚠️ User not found in DB for email: ${mail}. Creating pending user...`);
                // Create a pending user (invitation)
                targetUser = await User.create({
                    email: mail.toLowerCase().trim(),
                    name: mail.split('@')[0], // Use email prefix as temporary name
                    is_active: false,
                    setup_completed: false
                });
            }

            console.log(`[INVITE] Target User: ${targetUser._id} (${targetUser.email})`);
            
            const existing = await TeamMember.findOne({
                team_id: targetTeamId,
                user_id: targetUser._id,
            });

            let skipEmail = false;

            if (existing) {
                console.log(`[INVITE] Existing record found: { is_active: ${existing.is_active}, pending: ${existing.pending_invitation}, role: ${existing.role} }`);
                
                // Case: already an active member (not pending)
                if (existing.is_active && !existing.pending_invitation) {
                    const msg = 'Member is already in team';
                    if (isSingleInvite) return res.status(409).json({ done: false, message: msg, body: { email: mail, code: 'TEAM_MEMBER_EXISTS' } });
                    errors.push({ email: mail, error: msg, code: 'TEAM_MEMBER_EXISTS' });
                    continue;
                }

                // Case: previously invited but invitation is still pending - re-send notification
                if (existing.pending_invitation) {
                    // Update role in case it changed
                    existing.role = assignedRole;
                    await existing.save();
                    console.log(`[INVITE] Resending invitation notification to existing pending member`);
                } else if (!existing.is_active) {
                    // Case: was previously deactivated - re-invite them
                    existing.is_active = false;
                    existing.pending_invitation = true;
                    existing.role = assignedRole;
                    await existing.save();
                    console.log(`[INVITE] Re-inviting previously deactivated member`);
                }
            } else {
                // No existing record — create fresh invitation
                await TeamMember.create({
                    team_id: targetTeamId,
                    user_id: targetUser._id,
                    role: assignedRole,
                    job_title: job_title || null,
                    is_active: false,
                    pending_invitation: true
                });
                console.log(`[INVITE] Created fresh TeamMember record`);
            }

            // Create internal notification
            if (targetUser._id.toString() !== req.user._id.toString()) {
                await Notification.create({
                    user_id: targetUser._id,
                    team_id: targetTeamId,
                    type: 'team_invite',
                    message: `You have been invited to join team "${teamName}" as an ${assignedRole === 'admin' ? 'Admin' : 'Member'} by ${req.user.name}`
                });

                // Emit real-time socket notification
                const io = req.app.get('io');
                if (io) {
                    io.to(targetUser._id.toString()).emit('notification', {
                        type: 'team_invite',
                        message: `You have been invited to join team "${teamName}" by ${req.user.name}`,
                        team_id: targetTeamId
                    });
                }
            }

            // Send actual email
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            // If user exists and is active, they just need to log in.
            // If they are new/pending, they need to sign up.
            const inviteLink = targetUser.is_active 
                ? `${frontendUrl}/auth/login` 
                : `${frontendUrl}/auth/signup?email=${encodeURIComponent(targetUser.email)}`;

            await emailService.sendTeamInviteEmail(
                targetUser.email,
                req.user.name,
                teamName,
                inviteLink,
                assignedRole
            );

            results.push({ email: mail, status: 'Invited (Email sent)', user: targetUser });
        } catch (err) {
            console.error(`[INVITE] ❌ Error processing ${mail}:`, err.message);
            errors.push({ email: mail, error: err.message });
        }
    }
    
    console.log(`[INVITE] Done. Results: ${results.length}, Errors: ${errors.length}`);
    res.json({
      done: true,
      body: { results, errors, team_id: targetTeamId },
      message: `Processed ${results.length} members`
    });
  } catch (error) {
    console.error('[INVITE] Fatal error:', error.message);
    res.status(500).json({ done: false, message: 'Failed to add team members: ' + error.message });
  }
});



// GET /api/team-members/project/:projectId
router.get('/project/:projectId', async (req, res) => {
    try {
        const { ProjectMember } = require('../models');
        const members = await ProjectMember.find({ 
            project_id: req.params.projectId, 
            is_active: true 
        }).populate('user_id', 'name email avatar_url');

        const userIds = members
          .map(m => m?.user_id?._id)
          .filter(Boolean);
        const teamMembers = await TeamMember.find({
          user_id: { $in: userIds },
          is_active: true,
        }).select('_id user_id');
        const userToTeamMemberMap = {};
        teamMembers.forEach(tm => {
          if (tm?.user_id) {
            userToTeamMemberMap[tm.user_id.toString()] = tm._id?.toString();
          }
        });
        
        res.json({
            done: true,
            body: members.map(m => ({
                id: m.user_id._id,
                user_id: m.user_id._id,
                team_member_id: m.team_member_id || userToTeamMemberMap[m.user_id?._id?.toString()] || null,
                name: m.user_id.name,
                email: m.user_id.email,
                avatar_url: m.user_id.avatar_url,
                role: m.role,
                project_member_id: m._id
            }))
        });
    } catch (error) {
        res.status(500).json({ done: false, message: error.message });
    }
});

// GET /api/team-members/:id - Get a single team member by user ID
router.get('/:id', async (req, res) => {
    try {
        const memberId = req.params.id;

        // Find the TeamMember record by user_id in the context of the CURRENT team
        let member = await TeamMember.findOne({ 
            user_id: memberId, 
            team_id: req.user.last_team_id,
            is_active: true 
        }).populate('user_id', 'name email avatar_url color_code')
          .populate('manager_id', 'name email avatar_url');

        // Fallback: try by TeamMember document _id (still validating team_id for security)
        if (!member) {
            member = await TeamMember.findOne({
                _id: memberId,
                team_id: req.user.last_team_id
            }).populate('user_id', 'name email avatar_url color_code')
              .populate('manager_id', 'name email avatar_url');
        }

        if (!member || !member.user_id) {
            return res.status(404).json({ done: false, message: 'Team member not found' });
        }

        res.json({
            done: true,
            body: {
                id: member.user_id._id,
                user_id: member.user_id._id,
                team_member_id: member._id,
                name: member.user_id.name,
                email: member.user_id.email,
                avatar_url: member.user_id.avatar_url,
                color_code: member.user_id.color_code,
                role: member.role,
                role_name: member.role,
                is_admin: member.role === 'admin' || member.role === 'owner',
                job_title: member.job_title,
                manager_id: member.manager_id?._id || member.manager_id,
                manager_name: member.manager_id?.name,
                is_active: member.is_active,
                joined_at: member.joined_at,
                created_at: member.created_at,
                updated_at: member.updated_at
            }
        });
    } catch (error) {
        console.error('Get team member by ID error:', error.message);
        res.status(500).json({ done: false, message: 'Failed to fetch team member' });
    }
});

// PUT /api/team-members/:id - Update a team member
router.put('/:id', async (req, res) => {
    try {
        const { role, job_title, is_admin, manager_id } = req.body;
        const memberId = req.params.id;

        // Determine derived role if is_admin is provided
        let targetRole = role;
        if (is_admin !== undefined) {
            targetRole = is_admin ? 'admin' : 'member';
        }

        // Find the member first
        let member = await TeamMember.findById(memberId);
        if (!member) {
            // Fallback: search by user_id in the current team
            member = await TeamMember.findOne({ 
                user_id: memberId, 
                team_id: req.user.last_team_id,
                is_active: true 
            });
        }

        if (!member) {
            return res.status(404).json({ done: false, message: 'Team member not found' });
        }

        // 3. Update fields
        if (targetRole) member.role = targetRole;
        if (job_title !== undefined) member.job_title = job_title;
        if (manager_id !== undefined) member.manager_id = manager_id || null;
        
        await member.save();

        // 4. Sync User permissions and notify via Socket
        if (member.user_id) {
            const isNowAdmin = targetRole === 'admin' || targetRole === 'owner';
            
            // Atomic update of User model to reflect new permissions immediately
            await User.findByIdAndUpdate(member.user_id, { is_admin: isNowAdmin });
            
            // Emit real-time notification to the target user
            const io = req.app.get('io');
            if (io) {
                // Constants to match SocketEvents enum
                const TEAM_MEMBER_ROLE_CHANGE = 60; 
                
                io.to(member.user_id.toString()).emit('notification', {
                    type: 'role_change',
                    message: `Your role has been updated to ${targetRole}`,
                    role: targetRole
                });

                // Directly notify the frontend to refresh the session/user data
                io.to(member.user_id.toString()).emit(TEAM_MEMBER_ROLE_CHANGE.toString(), {
                    memberId: member.user_id.toString(),
                    role_name: targetRole,
                    is_admin: isNowAdmin
                });
                
                console.log(`[ROLE_CHANGE] ✅ Socket notification emitted to user ${member.user_id} (Role: ${targetRole})`);
            }
        }

        res.json({ done: true, body: member });
    } catch (error) {
        console.error('Update team member error:', error.message);
        res.status(500).json({ done: false, message: error.message });
    }
});

// DELETE /api/team-members/:id - Remove a team member
router.delete('/:id', async (req, res) => {
    try {
        const memberId = req.params.id;
        
        let member = await TeamMember.findById(memberId);
        if (!member) {
            member = await TeamMember.findOne({ 
                user_id: memberId, 
                team_id: req.user.last_team_id,
                is_active: true 
            });
        }

        if (!member) {
            return res.status(404).json({ done: false, message: 'Team member not found' });
        }

        member.is_active = false;
        await member.save();

        res.json({ done: true, message: 'Team member removed' });
    } catch (error) {
        res.status(500).json({ done: false, message: error.message });
    }
});

module.exports = router;

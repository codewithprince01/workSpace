
const express = require('express');
const router = express.Router();
const teamsController = require('../controllers/teams.controller');
const authController = require('../controllers/auth.controller');
const { protect, adminOnly } = require('../middlewares/auth.middleware');

router.use(protect);

// GET /api/admin-center/organization
router.get('/organization', async (req, res) => {
  try {
    const { Team, User, TeamMember } = require('../models');
    
    // Find a team where user is member
    const membership = await TeamMember.findOne({ user_id: req.user._id, is_active: true }).populate('team_id');
    const team = membership ? membership.team_id : await Team.findOne({ owner_id: req.user._id });

    if (!team) {
      return res.status(404).json({ done: false, message: 'Organization not found' });
    }

    const owner = await User.findById(team.owner_id);

    res.json({
      done: true,
      body: {
        id: team._id,
        name: team.name,
        logo_url: team.logo_url || null,
        owner_name: owner ? owner.name : 'Unknown',
        email: owner ? owner.email : '-',
        contact_number: owner ? owner.phone || owner.contact_number : '-',
        contact_number_secondary: '-'
      }
    });
  } catch (error) {
    res.status(500).json({ done: false, message: error.message });
  }
});

// PUT /api/admin-center/organization
router.put('/organization', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const targetTeamId = req.user.last_team_id;

    let teamId = targetTeamId;
    if (!isSuperAdmin) {
      const membership = await TeamMember.findOne({ 
        user_id: req.user._id, 
        team_id: targetTeamId,
        is_active: true, 
        role: { $in: ['admin', 'owner'] } 
      });
      if (!membership) return res.status(403).json({ done: false, message: 'Only admins can update organization name' });
      teamId = membership.team_id;
    }

    if (!teamId) return res.status(404).json({ done: false, message: 'Organization not found' });

    const team = await Team.findByIdAndUpdate(teamId, { name }, { new: true });
    
    res.json({
      done: true,
      body: { name: team.name }
    });
  } catch (error) {
    res.status(500).json({ done: false, message: error.message });
  }
});

// PUT /api/admin-center/organization/logo
router.put('/organization/logo', async (req, res) => {
  try {
    const { Team, TeamMember } = require('../models');
    const storageService = require('../services/storage.service');
    const { file, file_name } = req.body;

    const isSuperAdmin = req.user.role === 'super_admin';
    const teamId = req.user.last_team_id;

    if (!isSuperAdmin) {
      return res.status(403).json({ done: false, message: 'Only super admins can update organization logo' });
    }

    if (!teamId) return res.status(404).json({ done: false, message: 'Organization not found' });
    if (!file) return res.status(400).json({ done: false, message: 'No file provided' });

    const extension = file_name.split('.').pop();
    const key = `logos/${teamId}_${Date.now()}.${extension}`;
    
    const logoUrl = await storageService.uploadBase64(key, file, file_name, req.user._id);
    
    const team = await Team.findByIdAndUpdate(teamId, { logo_url: logoUrl }, { new: true });

    res.json({
      done: true,
      body: { logo_url: team.logo_url }
    });
  } catch (error) {
    res.status(500).json({ done: false, message: error.message });
  }
});

// PUT /api/admin-center/organization/owner/contact-number
router.put('/organization/owner/contact-number', async (req, res) => {
  try {
    const { User, TeamMember } = require('../models');
    const { contact_number } = req.body;

    const membership = await TeamMember.findOne({ user_id: req.user._id, is_active: true, role: 'owner' });
    if (!membership) return res.status(403).json({ done: false, message: 'Only owners can update contact number' });

    const user = await User.findByIdAndUpdate(req.user._id, { phone: contact_number }, { new: true });

    res.json({
      done: true,
      body: { contact_number: user.phone }
    });
  } catch (error) {
    res.status(500).json({ done: false, message: error.message });
  }
});

// GET /api/admin-center/organization/admins
router.get('/organization/admins', async (req, res) => {
  try {
    const { TeamMember, User } = require('../models');
    
    const membership = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
    if (!membership) return res.json({ done: true, body: [] });

    const admins = await TeamMember.find({
      team_id: membership.team_id,
      role: { $in: ['admin', 'owner'] },
      is_active: true
    }).populate('user_id', 'name email avatar_url');

    res.json({
      done: true,
      body: admins.filter(a => a.user_id).map(a => ({
        user_id: a.user_id._id,
        name: a.user_id.name,
        email: a.user_id.email,
        avatar_url: a.user_id.avatar_url,
        is_owner: a.role === 'owner',
        is_admin: true
      }))
    });
  } catch (error) {
    res.status(500).json({ done: false, message: error.message });
  }
});

// GET /api/admin-center/organization/teams
router.get('/organization/teams', async (req, res) => {
    try {
        const { Team, TeamMember } = require('../models');
        const { index, size, search } = req.query;
        const page = parseInt(index) || 0;
        const limit = parseInt(size) || 10;
        const skip = page * limit;

        const memberships = await TeamMember.find({ user_id: req.user._id, is_active: true });
        
        let teamIds = [];
        if (Array.isArray(memberships)) {
            teamIds = Array.from(
              new Set(memberships.map(m => (m.team_id ? m.team_id.toString() : null)).filter(Boolean))
            );
        }

        const query = { _id: { $in: teamIds }, is_active: true };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const teams = await Team.find(query)
            .populate('owner_id', 'name email avatar_url')
            .skip(skip)
            .limit(limit);

        const total = await Team.countDocuments(query);

        // Map teams to include 'id', 'names' and 'members_count' for frontend compatibility
        const formattedTeams = await Promise.all(teams.map(async team => {
            const membersCount = await TeamMember.countDocuments({ team_id: team._id, is_active: true });
            
            // Get sample members for avatars
            const sampleMembers = await TeamMember.find({ team_id: team._id, is_active: true })
                .populate('user_id', 'name email avatar_url')
                .limit(5);

            return {
                id: team._id,
                name: team.name,
                owns_by: team.owner_id?.name || 'Unknown',
                members_count: membersCount,
                names: sampleMembers.map(m => m.user_id ? {
                    name: m.user_id.name,
                    avatar_url: m.user_id.avatar_url,
                    color_code: '#1890ff' // fallback
                } : null).filter(Boolean)
            };
        }));

        res.json({
            done: true,
            body: {
                data: formattedTeams,
                total: total
            }
        });
    } catch (error) {
        res.status(500).json({ done: false, message: error.message });
    }
});

// GET /api/admin-center/organization/users
router.get('/organization/users', async (req, res) => {
    try {
        const { TeamMember, User } = require('../models');
        const { index, size, searchTerm } = req.query;
        const page = parseInt(index) || 0;
        const limit = parseInt(size) || 10;
        const skip = page * limit;

        const membership = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
        if (!membership) return res.json({ done: true, body: { data: [], total: 0 } });

        const query = { team_id: membership.team_id, is_active: true };

        if (searchTerm) {
            const matchedUsers = await User.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { email: { $regex: searchTerm, $options: 'i' } }
                ]
            }).select('_id');
            const userIds = matchedUsers.map(u => u._id);
            query.user_id = { $in: userIds };
        }
        
        const members = await TeamMember.find(query)
            .populate('user_id', 'name email avatar_url updated_at last_active_at')
            .skip(skip)
            .limit(limit);

        const total = await TeamMember.countDocuments(query);

        res.json({
            done: true,
            body: {
                data: members.filter(m => m.user_id).map(m => ({
                    user_id: m.user_id._id,
                    name: m.user_id.name,
                    email: m.user_id.email,
                    avatar_url: m.user_id.avatar_url,
                    last_logged: m.user_id.last_active_at || m.user_id.updated_at,
                    is_owner: m.role === 'owner',
                    is_admin: m.role === 'admin'
                })),
                total
            }
        });
    } catch (error) {
        res.status(500).json({ done: false, message: error.message });
    }
});

// GET /api/admin-center/organization/projects
router.get('/organization/projects', async (req, res) => {
    try {
        const { Project, TeamMember, ProjectMember } = require('../models');
        const { index, size, search } = req.query;
        const page = parseInt(index) || 0;
        const limit = parseInt(size) || 10;
        const skip = page * limit;

        const memberships = await TeamMember.find({ user_id: req.user._id, is_active: true }).populate('team_id');
        if (!memberships || memberships.length === 0) return res.json({ done: true, body: { data: [], total: 0 } });

        const teamIds = memberships.map(m => m.team_id ? (m.team_id._id || m.team_id) : null).filter(Boolean);

        const query = { team_id: { $in: teamIds }, is_archived: false };
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const projects = await Project.find(query)
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Project.countDocuments(query);

        // Map team IDs to team names for fast lookup
        const teamMap = new Map();
        memberships.forEach(m => {
            if (m.team_id) teamMap.set(m.team_id._id.toString(), m.team_id.name);
        });

        const projectData = await Promise.all(projects.map(async p => {
            const memberCount = await ProjectMember.countDocuments({ project_id: p._id, is_active: true });
            return {
                id: p._id,
                name: p.name,
                created_at: p.created_at,
                member_count: memberCount,
                team_name: teamMap.get(p.team_id?.toString()) || '-'
            };
        }));

        res.json({
            done: true,
            body: {
                data: projectData,
                total
            }
        });
    } catch (error) {
        res.status(500).json({ done: false, message: error.message });
    }
});

// GET /api/admin-center/organization/team/:teamId
router.get('/organization/team/:teamId', async (req, res) => {
    try {
        const { Team, TeamMember } = require('../models');
        const teamId = req.params.teamId;

        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ done: false, message: 'Team not found' });

        const members = await TeamMember.find({ team_id: teamId, is_active: true })
            .populate('user_id', 'name email avatar_url color_code');

        res.json({
            done: true,
            body: {
                id: team._id,
                name: team.name,
                created_at: team.created_at,
                team_members: members.map(m => ({
                    id: m._id,
                    user_id: m.user_id ? m.user_id._id : null,
                    name: m.user_id ? m.user_id.name : 'Unknown',
                    email: m.user_id ? m.user_id.email : '',
                    avatar_url: m.user_id ? m.user_id.avatar_url : null,
                    color_code: m.user_id ? m.user_id.color_code : '#1890ff',
                    role_name: m.role || 'member',
                    created_at: m.created_at,
                    pending_invitation: m.pending_invitation || false
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ done: false, message: error.message });
    }
});

// DELETE /api/admin-center/organization/team/:teamId
router.delete('/organization/team/:teamId', async (req, res) => {
    try {
        const { Team, TeamMember } = require('../models');
        const teamId = req.params.teamId;

        const membership = await TeamMember.findOne({ user_id: req.user._id, is_active: true, role: { $in: ['admin', 'owner'] } });
        if (!membership) return res.status(403).json({ done: false, message: 'Permission denied' });

        await Team.findByIdAndUpdate(teamId, { is_active: false });

        res.json({
            done: true,
            message: 'Team successfully deleted'
        });
    } catch (error) {
        res.status(500).json({ done: false, message: error.message });
    }
});

// PUT /api/admin-center/organization/team/:teamId
router.put('/organization/team/:teamId', async (req, res) => {
    try {
        const { Team, TeamMember } = require('../models');
        const teamId = req.params.teamId;
        const { name } = req.body;

        const membership = await TeamMember.findOne({ user_id: req.user._id, is_active: true, role: { $in: ['admin', 'owner'] } });
        if (!membership) return res.status(403).json({ done: false, message: 'Permission denied' });

        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ done: false, message: 'Team not found' });

        if (name) {
            team.name = name;
            await team.save();
        }

        res.json({
            done: true,
            body: { id: team._id, name: team.name }
        });
    } catch (error) {
        res.status(500).json({ done: false, message: error.message });
    }
});

// PUT /api/admin-center/organization/team-member/:team_member_id
router.put('/organization/team-member/:team_member_id', async (req, res) => {
    try {
        const { TeamMember } = require('../models');
        const memberId = req.params.team_member_id;

        const authMembership = await TeamMember.findOne({ user_id: req.user._id, is_active: true, role: { $in: ['admin', 'owner'] } });
        if (!authMembership) return res.status(403).json({ done: false, message: 'Permission denied' });

        await TeamMember.findByIdAndUpdate(memberId, { is_active: false });

        res.json({
            done: true,
            message: 'Member removed from team'
        });
    } catch (error) {
        res.status(500).json({ done: false, message: error.message });
    }
});

// GET /api/admin-center/billing/subscription
router.get('/billing/subscription', (req, res) => {
  res.json({
    done: true,
    body: {
      plan: 'free',
      status: 'active'
    }
  });
});

// GET /api/admin-center/billing/info
router.get('/billing/info', (req, res) => {
  res.json({
    done: true,
    body: {
      subscription_type: 'free',
      status: 'active',
      plan_name: 'Worklenz Free',
      total_seats: 5,
      total_used: 1,
      is_custom: false,
      trial_in_progress: false
    }
  });
});

// GET /api/admin-center/billing/free-plan
router.get('/billing/free-plan', (req, res) => {
  res.json({
    done: true,
    body: {
      team_member_limit: 5,
      projects_limit: 10,
      free_tier_storage: 500
    }
  });
});

// GET /api/admin-center/billing/account-storage
router.get('/billing/account-storage', (req, res) => {
  res.json({
    done: true,
    body: {
      used_storage: 10,
      total_storage: 500,
      percentage: 2
    }
  });
});

// GET /api/admin-center/billing/configuration
router.get('/billing/configuration', (req, res) => {
  res.json({
    done: true,
    body: {
      billing_email: req.user ? req.user.email : '',
      address_line_1: '',
      city: '',
      country: '',
      vat_number: ''
    }
  });
});

// GET /api/admin-center/billing/charges
router.get('/billing/charges', (req, res) => {
  res.json({ done: true, body: { previous_charges: [], upcoming_charges: [] } });
});

// GET /api/admin-center/billing/transactions
router.get('/billing/transactions', (req, res) => {
  res.json({ done: true, body: [] });
});

module.exports = router;

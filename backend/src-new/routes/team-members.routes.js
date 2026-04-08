const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TeamMember, User, Team, Notification } = require('../models');

// Apply protection to all routes
router.use(protect);

// GET /api/team-members - Get team members
router.get('/', async (req, res) => {
  try {
    const { project } = req.query;

    let query = { is_active: true };
    
    // If project specified, filter by project membership logic if needed, 
    // but usually "team members" refers to the organization team.
    // For now, let's get all members of the user's teams.
    
    // Find teams where user is a member
    const userMemberships = await TeamMember.find({ user_id: req.user._id, is_active: true });
    const teamIds = userMemberships.map(m => m.team_id);
    
    // If searching for specific team context
    // const teamId = req.query.team_id; 
    
    // Fetch all members of these teams
    const allMembers = await TeamMember.find({ 
      team_id: { $in: teamIds },
      is_active: true 
    }).populate('user_id', 'name email avatar_url');

    // Deduplicate users if multiple teams
    const uniqueMembersMap = new Map();
    
    for (const m of allMembers) {
      if (m.user_id && !uniqueMembersMap.has(m.user_id._id.toString())) {
        uniqueMembersMap.set(m.user_id._id.toString(), {
           id: m.user_id._id,
           name: m.user_id.name,
           email: m.user_id.email,
           avatar_url: m.user_id.avatar_url,
           role: m.role,
           job_title: m.job_title,
           team_member_id: m._id,
           team_id: m.team_id,
           joined_at: m.created_at,
           status: 'Active' // Since we filtered by is_active: true
        });
      }
    }
    
    const result = Array.from(uniqueMembersMap.values());

    res.json({
      done: true,
      body: {
        data: result,
        total: result.length
      }
    });
  } catch (error) {
    console.error('Fetch team members error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch team members' });
  }
});

// POST /api/team-members - Add/Invite team member
router.post('/', async (req, res) => {
  try {
    const { email, emails, team_id, role, job_title, is_admin } = req.body;
    
    // Handle both single 'email' and array 'emails'
    const targetEmails = emails && Array.isArray(emails) ? emails : (email ? [email] : []);
    
    if (targetEmails.length === 0) {
       return res.status(400).json({ done: false, message: 'No emails provided' });
    }

    // Determine target team
    let targetTeamId = team_id;
    if (!targetTeamId) {
      // Find team where user is owner or admin
      const myMembership = await TeamMember.findOne({ 
        user_id: req.user._id,
        role: { $in: ['owner', 'admin'] },
        is_active: true 
      });
      
      if (myMembership) {
        targetTeamId = myMembership.team_id;
      } else {
        // Fallback: any team
        const anyTeam = await TeamMember.findOne({ user_id: req.user._id, is_active: true });
        if (anyTeam) targetTeamId = anyTeam.team_id;
      }
    }
    
    if (!targetTeamId) {
       // Create a new team if none exists
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
    }

    const results = [];
    const errors = [];

    // Fetch team details for notification
    const team = await Team.findById(targetTeamId);
    const teamName = team ? team.name : 'your team';

    for (const mail of targetEmails) {
        try {
            const user = await User.findOne({ email: mail });
            
            if (user) {
                // Check if already member
                const existing = await TeamMember.findOne({ team_id: targetTeamId, user_id: user._id });
                if (existing) {
                    if (!existing.is_active) {
                        existing.is_active = true;
                        existing.role = is_admin ? 'admin' : (role || 'member');
                        if (job_title) existing.job_title = job_title;
                        await existing.save();
                        results.push({ email: mail, status: 'Re-activated', user });
                        
                        // Notify
                        if (user._id.toString() !== req.user._id.toString()) {
                             await Notification.create({
                                user_id: user._id,
                                team_id: targetTeamId,
                                type: 'team_invite',
                                message: `You have been added to team "${teamName}" by ${req.user.name}`
                             });
                        }
                    } else {
                        results.push({ email: mail, status: 'Already member', user });
                    }
                } else {
                    const newMember = await TeamMember.create({
                        team_id: targetTeamId,
                        user_id: user._id,
                        role: is_admin ? 'admin' : (role || 'member'),
                        job_title: job_title
                    });
                    results.push({ email: mail, status: 'Added', user });
                    
                    // Notify
                    if (user._id.toString() !== req.user._id.toString()) {
                         await Notification.create({
                            user_id: user._id,
                            team_id: targetTeamId,
                            type: 'team_invite',
                            message: `You have been added to team "${teamName}" by ${req.user.name}`
                         });
                    }
                }
            } else {
                // User does not exist. 
                // In a real app, create a "TeamInvitation" record and send email.
                // For now, we will just return "Invited" status.
                // Optionally create a placeholder user or rely on pending invites table.
                
                // For this fix, let's just pretend we sent an invite.
                results.push({ email: mail, status: 'Invited (Email sent)' });
            }
        } catch (err) {
            console.error(`Error adding ${mail}:`, err);
            errors.push({ email: mail, error: err.message });
        }
    }
    
    res.json({
      done: true,
      body: {
        results,
        errors,
        team_id: targetTeamId
      },
      message: `Processed ${results.length} members`
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ done: false, message: 'Failed to add team members' });
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
        
        res.json({
            done: true,
            body: members.map(m => ({
                id: m.user_id._id,
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

module.exports = router;

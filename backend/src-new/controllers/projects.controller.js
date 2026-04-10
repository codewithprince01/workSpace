const { Project, ProjectMember, TaskStatus, Task, ProjectInvitation, Notification, User, TeamMember } = require('../models');
const constants = require('../config/constants');
const emailService = require('../services/email.service');
const crypto = require('crypto');
const mongoose = require('mongoose');

const normalizeKey = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, '_');

const pickFirstAllowed = (allowed, preferred = []) => {
  for (const item of preferred) {
    if (allowed.includes(item)) return item;
  }
  return allowed[0];
};

const normalizeProjectStatusValue = (input) => {
  const allowed = Project?.schema?.path('status')?.enumValues || [];
  if (!allowed.length) return undefined;

  const normalized = normalizeKey(input);
  const aliases = {
    cancelled: 'cancelled',
    blocked: 'blocked',
    on_hold: 'on_hold',
    proposed: 'proposed',
    in_planning: 'in_planning',
    in_progress: 'in_progress',
    completed: 'completed',
    active: 'active',
  };

  const mapped = aliases[normalized] || normalized;
  if (allowed.includes(mapped)) return mapped;

  if (mapped === 'proposed') return pickFirstAllowed(allowed, ['proposed', 'active', 'in_progress', 'on_hold']);
  if (mapped === 'in_planning') return pickFirstAllowed(allowed, ['in_planning', 'on_hold', 'active']);
  if (mapped === 'in_progress') return pickFirstAllowed(allowed, ['in_progress', 'active']);
  if (mapped === 'blocked') return pickFirstAllowed(allowed, ['blocked', 'on_hold', 'at_risk', 'active']);
  return pickFirstAllowed(allowed, ['active', 'in_progress', 'on_hold', 'proposed']);
};

const normalizeProjectHealthValue = (input) => {
  const allowed = Project?.schema?.path('health')?.enumValues || [];
  if (!allowed.length) return undefined;

  const normalized = normalizeKey(input);
  const aliases = {
    not_set: 'not_set',
    needs_attention: 'needs_attention',
    at_risk: 'at_risk',
    good: 'good',
    critical: 'critical',
    on_track: 'good',
    off_track: 'at_risk',
    '1': 'good',
    '2': 'at_risk',
    '3': 'critical',
  };

  const mapped = aliases[normalized] || normalized;
  if (allowed.includes(mapped)) return mapped;

  if (mapped === 'not_set') return pickFirstAllowed(allowed, ['not_set', 'good', 'at_risk']);
  if (mapped === 'needs_attention') return pickFirstAllowed(allowed, ['needs_attention', 'at_risk', 'critical']);
  return pickFirstAllowed(allowed, ['good', 'at_risk', 'critical', 'not_set']);
};

const extractObjectId = (value) => {
  if (!value) return null;
  const id = typeof value === 'object' ? (value.id || value._id) : value;
  if (!id) return null;
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
};

/**
 * @desc    Invite member to project
 * @route   POST /api/projects/:id/invite
 * @access  Private (Admin/Owner)
 */
exports.inviteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body; // role: 'admin' or 'member'

    // Validate inputs
    if (!email || !role) {
      return res.status(400).json({ success: false, message: 'Email and role are required' });
    }

    // Check project exists
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    // Check if user is already a member
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const isMember = await ProjectMember.findOne({ project_id: id, user_id: existingUser._id });
      if (isMember) {
        return res.status(409).json({ success: false, message: 'Member is already in project' });
      }
    }

    // Prevent duplicate pending invitations for same project + email
    const pendingInvite = await ProjectInvitation.findOne({
      project_id: id,
      email: email.toLowerCase(),
      status: 'pending',
      expires_at: { $gt: new Date() },
    });
    if (pendingInvite) {
      return res.status(409).json({
        success: false,
        message: 'Member is already invited to project',
      });
    }

    // Create Invite Token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    console.log('Creating Invitation...');
    // Create Invitation Record
    const invitation = await ProjectInvitation.create({
      project_id: id,
      inviter_id: req.user._id,
      email,
      role,
      token,
      expires_at: expiresAt
    });
    console.log('Invitation created:', invitation._id);

    // Send Email
    // const inviteLink = `${process.env.FRONTEND_URL}/worklenz/invite/accept?token=${token}`; 
    // Assuming structure, constructing link manually for now or use env
    const inviteLink = `http://localhost:5173/worklenz/invite/project/${token}`; // TODO: Use env variable

    await emailService.sendProjectInviteEmail(email, req.user.name, project.name, inviteLink, role);

    // Create Notification for Inviter
    await Notification.create({
      user_id: req.user._id,
      project_id: id,
      type: 'project_invite',
      message: `Invitation sent successfully to ${email}`
    });

    // Create Notification for Invited User (if they exist)
    if (existingUser) {
      await Notification.create({
        user_id: existingUser._id,
        project_id: id,
        type: 'project_invite',
        message: `You have been invited to join ${project.name} as ${role}`
      });
    }

    res.json({
      done: true,
      message: 'Invitation sent successfully',
      body: invitation
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept project invitation
 * @route   POST /api/projects/invite/accept
 * @access  Private (Authenticated User)
 */
exports.acceptInvite = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    // Find invitation
    const invitation = await ProjectInvitation.findOne({ 
      token, 
      status: 'pending',
      expires_at: { $gt: new Date() }
    });

    if (!invitation) {
      return res.status(400).json({ done: false, message: 'Invalid or expired invitation' });
    }

    // Add to Project Members
    await ProjectMember.create({
      project_id: invitation.project_id,
      user_id: req.user._id,
      role: invitation.role
    });

    // Update Invitation Status
    invitation.status = 'accepted';
    await invitation.save();

    res.json({
      done: true,
      message: 'Joined project successfully',
      body: { projectId: invitation.project_id }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create project
 * @route   POST /api/projects
 * @access  Private
 */
exports.create = async (req, res, next) => {
  try {
    const {
      name,
      description,
      notes,
      key,
      color_code,
      start_date,
      end_date,
      status,
      status_id,
      health,
      health_id,
      category_id,
      client_id,
      client_name,
      project_manager,
      project_manager_id,
      working_days,
      man_days,
      hours_per_day,
      use_manual_progress,
      use_weighted_progress,
      use_time_progress,
    } = req.body;
    
    let team_id = req.body.team_id;
    if (!team_id) {
        // Find user's team - team should already exist from signup
        const membership = await TeamMember.findOne({ 
          user_id: req.user._id, 
          is_active: true 
        }).sort({ role: 1 }); 
        
        if (!membership) {
            return res.status(400).json({
                success: false,
                message: 'No team found. Please create or join a team first.'
            });
        }
        
        team_id = membership.team_id;
    }
    
    // Generate project key if not provided
    const projectKey = key || name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 100);
    
    const normalizedStatus = normalizeProjectStatusValue(status || status_id) || 'active';
    const normalizedHealth = normalizeProjectHealthValue(health || health_id) || 'good';
    const normalizedCategoryId = extractObjectId(category_id);
    const normalizedClientId = extractObjectId(client_id);
    const normalizedProjectManagerId = extractObjectId(project_manager_id || project_manager);

    // Create project
    const project = await Project.create({
      name,
      description: description ?? notes ?? null,
      notes: notes ?? description ?? null,
      key: projectKey,
      team_id,
      owner_id: req.user._id,
      color_code: color_code || constants.TASK_STATUS_COLORS.TODO,
      status: normalizedStatus,
      health: normalizedHealth,
      category_id: normalizedCategoryId,
      client_id: normalizedClientId,
      client_name: client_name || null,
      project_manager_id: normalizedProjectManagerId,
      start_date: start_date || null,
      end_date: end_date || null,
      working_days: Number.isFinite(+working_days) ? +working_days : 0,
      man_days: Number.isFinite(+man_days) ? +man_days : 0,
      hours_per_day: Number.isFinite(+hours_per_day) ? +hours_per_day : 8,
      use_manual_progress: !!use_manual_progress,
      use_weighted_progress: !!use_weighted_progress,
      use_time_progress: !!use_time_progress,
    });
    
    // Add creator as project member
    await ProjectMember.create({
      project_id: project._id,
      user_id: req.user._id,
      role: 'owner'
    });
    
    // Create default task statuses
    const defaultStatuses = [
      { name: 'To Do', category: 'todo', color_code: '#75c9c0', sort_order: 0, is_default: true },
      { name: 'In Progress', category: 'doing', color_code: '#3b7ad4', sort_order: 1 },
      { name: 'Done', category: 'done', color_code: '#70a6f3', sort_order: 2 }
    ];
    
    for (const status of defaultStatuses) {
      await TaskStatus.create({
        ...status,
        project_id: project._id
      });
    }
    
    res.status(201).json({
      done: true,
      body: {
        ...project.toObject(),
        id: project._id
      },
      message: "Project created successfully"
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all projects
 * @route   GET /api/projects
 * @access  Private
 */
exports.getAll = async (req, res, next) => {
  try {
    const { team_id, status, search, index, size, field, order, archived, starred, group_by } = req.query;

    // Default limit
    const page = parseInt(index) || 1;
    const limit = parseInt(size) || 20;
    const skip = (page - 1) * limit;

    // Filter project memberships
    const memberQuery = { user_id: req.user._id, is_active: true };
    if (starred === 'true') {
        memberQuery.is_favorite = true;
    }
    const memberProjects = await ProjectMember.find(memberQuery);
    
    let projectIds = memberProjects.map(pm => pm.project_id);

    // Build project query
    const query = {
      _id: { $in: projectIds }
    };
    
    if (archived === 'true') {
        query.is_archived = true;
    } else {
        query.is_archived = false;
    }
    
    if (team_id) {
        if (mongoose.Types.ObjectId.isValid(team_id)) {
             query.team_id = new mongoose.Types.ObjectId(team_id);
        } else {
             query.team_id = team_id;
        }
    } else {
        const userTeamId = req.user.last_team_id;
        if (userTeamId) query.team_id = userTeamId;
    }
    if (status) query.status = status; 
    if (search) query.name = { $regex: search, $options: 'i' };

    let sort = {}; 
    if (group_by) {
        if (group_by === 'category') sort['category_id'] = 1;
        else if (group_by === 'status') sort['status'] = 1;
        else if (group_by === 'health') sort['health'] = 1;
        else if (group_by === 'client') sort['client_id'] = 1; 
    }
    
    if (field && order) {
        sort[field] = order === 'ascend' ? 1 : -1;
    } else if (!group_by) {
        sort['updated_at'] = -1;
    }

    const total = await Project.countDocuments(query);

    const projectsWithCounts = await Project.aggregate([
      { $match: query },
      { $sort: Object.keys(sort).length ? sort : { updated_at: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'taskstatuses',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$project_id', '$$pid'] }, { $eq: ['$category', 'done'] }] } } },
            { $project: { _id: 1 } }
          ],
          as: 'done_statuses'
        }
      },
      {
        $lookup: {
          from: 'tasks',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$project_id', '$$pid'] }, { $eq: ['$is_archived', false] }] } } },
            { $count: 'count' }
          ],
          as: 'task_count'
        }
      },
      {
        $lookup: {
          from: 'tasks',
          let: { pid: '$_id', doneIds: '$done_statuses._id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$project_id', '$$pid'] },
              { $eq: ['$is_archived', false] },
              { $in: ['$status_id', '$$doneIds'] }
            ] } } },
            { $count: 'count' }
          ],
          as: 'completed_count'
        }
      },
      {
        $lookup: {
          from: 'projectmembers',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$project_id', '$$pid'] }, { $eq: ['$is_active', true] }] } } },
            { $limit: 5 },
            {
              $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1, avatar_url: 1, color_code: 1 } }],
                as: 'user'
              }
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
          ],
          as: 'member_docs'
        }
      },
      {
        $lookup: {
          from: 'projectmembers',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$project_id', '$$pid'] },
              { $eq: ['$user_id', new mongoose.Types.ObjectId(req.user._id)] }
            ] } } },
            { $project: { is_favorite: 1 } }
          ],
          as: 'my_membership'
        }
      },
      { $lookup: { from: 'users', localField: 'owner_id', foreignField: '_id', pipeline: [{ $project: { name: 1, email: 1, avatar_url: 1 } }], as: 'owner_doc' } },
      { $unwind: { path: '$owner_doc', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'projectcategories', localField: 'category_id', foreignField: '_id', pipeline: [{ $project: { name: 1, color_code: 1 } }], as: 'category_doc' } },
      { $unwind: { path: '$category_doc', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          id: '$_id',
          total_tasks: { $ifNull: [{ $arrayElemAt: ['$task_count.count', 0] }, 0] },
          completed_tasks: { $ifNull: [{ $arrayElemAt: ['$completed_count.count', 0] }, 0] },
          is_favorite: { $ifNull: [{ $arrayElemAt: ['$my_membership.is_favorite', 0] }, false] },
          favorite: { $ifNull: [{ $arrayElemAt: ['$my_membership.is_favorite', 0] }, false] },
          category_name: '$category_doc.name',
          category_color: '$category_doc.color_code',
          names: {
            $map: {
              input: '$member_docs',
              as: 'm',
              in: { id: '$$m.user._id', name: '$$m.user.name', avatar_url: '$$m.user.avatar_url', color_code: '$$m.user.color_code' }
            }
          }
        }
      },
      {
        $addFields: {
          progress: {
            $cond: [
              { $gt: ['$total_tasks', 0] },
              { $round: [{ $multiply: [{ $divide: ['$completed_tasks', '$total_tasks'] }, 100] }, 0] },
              0
            ]
          }
        }
      },
      { $project: { done_statuses: 0, task_count: 0, completed_count: 0, member_docs: 0, my_membership: 0, owner_doc: 0, category_doc: 0 } }
    ]);

    const allMemberships = await ProjectMember.find({ user_id: req.user._id, is_active: true });
    const allProjectIds = allMemberships.map(m => m.project_id);
    const favProjectIds = allMemberships.filter(m => m.is_favorite).map(m => m.project_id);

    const baseCountQuery = { _id: { $in: allProjectIds } };
    if (team_id) baseCountQuery.team_id = team_id;

    const [countAll, countArchived, countFavorites] = await Promise.all([
        Project.countDocuments({ ...baseCountQuery, is_archived: false }),
        Project.countDocuments({ ...baseCountQuery, is_archived: true }),
        Project.countDocuments({ ...baseCountQuery, _id: { $in: favProjectIds }, is_archived: false })
    ]);

    res.json({
      done: true,
      body: {
         data: projectsWithCounts,
         total: total,
         counts: {
              all: countAll,
              favorites: countFavorites,
              archived: countArchived
         }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get grouped projects
 * @route   GET /api/projects/grouped
 * @access  Private
 */
exports.getGrouped = async (req, res, next) => {
  try {
    const { team_id, status, search, index, size, field, order, archived, starred, groupBy } = req.query;
    const page = parseInt(index) || 1;
    const limit = parseInt(size) || 20;
    const skip = (page - 1) * limit;

    if (!req.user || !req.user._id) {
        return res.status(401).json({ done: false, message: 'Unauthorized' });
    }

    const memberQuery = { user_id: req.user._id, is_active: true };
    if (starred === 'true') memberQuery.is_favorite = true;
    const memberProjects = await ProjectMember.find(memberQuery);
    let projectIds = memberProjects.map(pm => pm.project_id);

    const query = { _id: { $in: projectIds } };
    if (archived === 'true') query.is_archived = true;
    else query.is_archived = false;

    if (team_id) query.team_id = team_id;
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    const projects = await Project.find(query)
      .populate('owner_id', 'name email avatar_url')
      .populate('category_id', 'name color_code')
      .populate('team_id', 'name')
      .sort({ [field || 'updated_at']: order === 'ascend' ? 1 : -1 })
      .lean();

    const allMemberships = await ProjectMember.find({ 
        project_id: { $in: projects.map(p => p._id) },
        is_active: true 
    }).populate('user_id', 'name avatar_url color_code');

    const userMembershipMap = {}; 
    memberProjects.forEach(m => userMembershipMap[m.project_id.toString()] = m.is_favorite);

    const enrichedProjects = await Promise.all(projects.map(async (p) => {
        const pMembers = allMemberships.filter(m => m.project_id.toString() === p._id.toString());
        const names = pMembers.slice(0, 5).map(m => m.user_id ? ({
            id: m.user_id._id,
            name: m.user_id.name,
            avatar_url: m.user_id.avatar_url,
            color_code: m.user_id.color_code
        }) : null).filter(Boolean);

        const totalTasks = await Task.countDocuments({ project_id: p._id, is_archived: false });
        const completedTasks = await Task.countDocuments({ 
            project_id: p._id, 
            is_archived: false, 
            status_id: { $in: await TaskStatus.find({ project_id: p._id, category: 'done' }).select('_id') } 
        });

        return {
            ...p,
            id: p._id,
            is_favorite: userMembershipMap[p._id.toString()] || false,
            favorite: userMembershipMap[p._id.toString()] || false,
            category_name: p.category_id ? p.category_id.name : null,
            category_color: p.category_id ? p.category_id.color_code : null,
            client_name: p.client_name || null,
            names,
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        };
    }));

    const groupsMap = new Map();
    const noGroupKey = 'uncategorized';

    enrichedProjects.forEach(p => {
        let key = noGroupKey;
        let name = 'Uncategorized';
        let color = '#d9d9d9';

        if (groupBy === 'category') {
            if (p.category_id) {
                key = p.category_id._id.toString();
                name = p.category_id.name;
                color = p.category_id.color_code;
            } else {
                name = 'No Category';
            }
        } else if (groupBy === 'client') {
            if (p.client_name) {
                key = p.client_name;
                name = p.client_name;
                color = '#1890ff';
            } else {
                name = 'No Client';
            }
        } 

        if (!groupsMap.has(key)) {
            groupsMap.set(key, {
                group_key: key,
                group_name: name,
                group_color: color,
                project_count: 0,
                projects: []
            });
        }
        const group = groupsMap.get(key);
        group.projects.push(p);
        group.project_count++;
    });

    const allGroups = Array.from(groupsMap.values());
    allGroups.sort((a, b) => a.group_name.localeCompare(b.group_name));
    const paginatedGroups = allGroups.slice(skip, skip + limit);

    res.json({
        done: true,
        body: {
            total_groups: allGroups.length,
            data: paginatedGroups
        }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get project members
 * @route   GET /api/projects/members/:id
 * @access  Private
 */
exports.getMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { index = 1, size = 10, search = '', field, order } = req.query;

    const membersDocs = await ProjectMember.find({ project_id: id, is_active: true })
      .populate('user_id', 'name email avatar_url job_title')
      .lean();

    let members = membersDocs
      .map(m => {
        const user = m.user_id || {};
        const userId = user._id || user.id;
        return {
          ...user,
          id: userId, 
          user_id: userId,
          project_member_id: m._id,
          role: m.role,
          is_active: m.is_active,
          access: m.role
        };
      })
      .filter(m => m.user_id);

    if (search) {
      const lowerSearch = search.toLowerCase();
      members = members.filter(
        m =>
          (m.name && m.name.toLowerCase().includes(lowerSearch)) ||
          (m.email && m.email.toLowerCase().includes(lowerSearch))
      );
    }

    const total = members.length;

    if (field && order) {
      members.sort((a, b) => {
        const valA = (a[field] || '').toString().toLowerCase();
        const valB = (b[field] || '').toString().toLowerCase();
        if (order === 'ascend') return valA.localeCompare(valB);
        return valB.localeCompare(valA);
      });
    }

    const pageIndex = parseInt(index);
    const pageSize = parseInt(size);
    const start = (pageIndex - 1) * pageSize;
    const paginatedMembers = members.slice(start, start + pageSize);

    const doneStatuses = await TaskStatus.find({ project_id: id, category: 'done' }).select('_id');
    const doneStatusIds = doneStatuses.map(s => s._id);

    const dataWithStats = await Promise.all(
      paginatedMembers.map(async m => {
        const memberId = m.user_id;
        const [all, done] = await Promise.all([
          Task.countDocuments({
            project_id: id,
            assignees: memberId,
            is_archived: { $ne: true }
          }),
          Task.countDocuments({
            project_id: id,
            assignees: memberId,
            status_id: { $in: doneStatusIds },
            is_archived: { $ne: true }
          })
        ]);

        return {
          ...m,
          all_tasks_count: all,
          completed_tasks_count: done
        };
      })
    );

    res.json({
      done: true,
      body: {
        total,
        data: dataWithStats,
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get overview members (with task statistics)
 * @route   GET /api/projects/overview-members/:id
 * @access  Private
 */
exports.getOverviewMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';

    const members = await ProjectMember.find({ project_id: id, is_active: true })
      .populate('user_id', 'name email avatar_url');

    const doneStatuses = await TaskStatus.find({ project_id: id, category: 'done' }).select('_id');
    const doneStatusIds = doneStatuses.map(s => s._id);

    const totalProjectTasks = await Task.countDocuments({
      project_id: id,
      is_archived: includeArchived ? { $in: [true, false] } : false
    });

    const memberStats = await Promise.all(members.map(async (m) => {
      if (!m.user_id) return null;

      const memberId = m.user_id._id;

      const taskCount = await Task.countDocuments({
        project_id: id,
        assignees: memberId,
        is_archived: includeArchived ? { $in: [true, false] } : false
      });

      const doneTaskCount = await Task.countDocuments({
        project_id: id,
        assignees: memberId,
        is_archived: includeArchived ? { $in: [true, false] } : false,
        status_id: { $in: doneStatusIds }
      });

      const pendingTaskCount = await Task.countDocuments({
        project_id: id,
        assignees: memberId,
        is_archived: includeArchived ? { $in: [true, false] } : false,
        status_id: { $nin: doneStatusIds }
      });

      const overdueTaskCount = await Task.countDocuments({
        project_id: id,
        assignees: memberId,
        is_archived: includeArchived ? { $in: [true, false] } : false,
        due_date: { $lt: new Date() },
        status_id: { $nin: doneStatusIds }
      });

      const contribution = totalProjectTasks > 0 ? Math.round((taskCount / totalProjectTasks) * 100) : 0;

      return {
        id: memberId,
        name: m.user_id.name,
        email: m.user_id.email,
        avatar_url: m.user_id.avatar_url,
        role: m.role,
        task_count: taskCount,
        contribution: contribution,
        done_task_count: doneTaskCount,
        pending_task_count: pendingTaskCount,
        overdue_task_count: overdueTaskCount
      };
    }));

    res.json({
      done: true,
      body: memberStats.filter(Boolean)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle project favorite
 * @route   GET /api/projects/favorite/:id
 * @access  Private
 */
exports.toggleFavorite = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user._id;

    const member = await ProjectMember.findOne({ 
      project_id: projectId, 
      user_id: userId 
    });

    if (!member) {
      return res.status(404).json({ done: false, message: 'Project member not found' });
    }

    const newFavStatus = !member.is_favorite;
    
    const updatedMember = await ProjectMember.findOneAndUpdate(
      { _id: member._id },
      { $set: { is_favorite: newFavStatus } },
      { new: true }
    );
    
    res.json({ 
        done: true, 
        body: {
            ...updatedMember.toObject(),
            favorite: updatedMember.is_favorite
        }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Archive project
 * @route   GET /api/projects/archive/:id
 * @access  Private
 */
exports.archive = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ done: false, message: 'Project not found' });
    
    project.is_archived = !project.is_archived;
    await project.save();
    
    res.json({ done: true, body: project });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Archive project for all (same as archive for now)
 * @route   GET /api/projects/archive-all/:id
 * @access  Private
 */
exports.archiveAll = async (req, res, next) => {
   return exports.archive(req, res, next);
};

/**
 * @desc    Update pinned view
 * @route   PUT /api/projects/update-pinned-view
 * @access  Private
 */
exports.updatePinnedView = async (req, res, next) => {
  try {
    const { project_id, default_view } = req.body;
    
    const member = await ProjectMember.findOneAndUpdate(
      { project_id, user_id: req.user._id },
      { default_view },
      { new: true }
    );
    
    res.json({ done: true, body: member });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single project
 * @route   GET /api/projects/:id
 * @access  Private
 */
exports.getById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner_id', 'name email avatar_url')
      .populate('category_id', 'name color_code')
      .populate('client_id', 'name')
      .populate('project_manager_id', 'name email avatar_url')
      .populate('team_id', 'name');
    
    if (!project) {
      return res.status(404).json({
        done: false,
        message: 'Project not found'
      });
    }
    
    const isMember = await ProjectMember.findOne({ 
      project_id: project._id, 
      user_id: req.user._id 
    });
    
    if (!isMember && !project.is_public && project.owner_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        done: false,
        message: 'Access denied'
      });
    }
    
    const statuses = await TaskStatus.find({ project_id: project._id }).sort({ sort_order: 1 });
    const members = await ProjectMember.find({ project_id: project._id, is_active: true })
      .populate('user_id', 'name email avatar_url');
    
    res.json({
      done: true,
      body: {
        ...project.toObject(),
        id: project._id,
        category_name: project.category_id ? project.category_id.name : null,
        category_color: project.category_id ? project.category_id.color_code : null,
        client_name: project.client_name || (project.client_id ? project.client_id.name : null),
        project_manager:
          project.project_manager_id && project.project_manager_id._id
            ? {
                id: project.project_manager_id._id,
                name: project.project_manager_id.name,
                email: project.project_manager_id.email,
                avatar_url: project.project_manager_id.avatar_url,
              }
            : null,
        project_manager_id:
          project.project_manager_id && project.project_manager_id._id
            ? project.project_manager_id._id
            : null,
        statuses,
        members: members.map(m => ({ ...m.user_id.toObject(), role: m.role })),
        is_favorite: isMember ? isMember.is_favorite : false,
        favorite: isMember ? isMember.is_favorite : false,
        current_user_role: isMember ? isMember.role : (project.owner_id._id.toString() === req.user._id.toString() ? 'owner' : null)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update project
 * @route   PUT /api/projects/:id
 * @access  Private
 */
exports.update = async (req, res, next) => {
  try {
    const {
      name,
      description,
      notes,
      key,
      color_code,
      status,
      status_id,
      health,
      health_id,
      category_id,
      client_id,
      client_name,
      project_manager,
      project_manager_id,
      start_date,
      end_date,
      working_days,
      man_days,
      hours_per_day,
      use_manual_progress,
      use_weighted_progress,
      use_time_progress,
    } = req.body;
    
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        done: false,
        message: 'Project not found'
      });
    }
    
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (notes !== undefined) project.notes = notes;
    if (description !== undefined && notes === undefined) project.notes = description;
    if (notes !== undefined && description === undefined) project.description = notes;
    if (key !== undefined && key !== null && String(key).trim() !== '') {
      project.key = String(key).trim().toUpperCase();
    }
    if (color_code) project.color_code = color_code;
    if (status || status_id) {
      project.status = normalizeProjectStatusValue(status || status_id) || project.status;
    }
    if (health || health_id) {
      project.health = normalizeProjectHealthValue(health || health_id) || project.health;
    }
    if (category_id !== undefined) project.category_id = extractObjectId(category_id);
    if (client_id !== undefined) project.client_id = extractObjectId(client_id);
    if (client_name !== undefined) project.client_name = client_name || null;
    if (project_manager !== undefined || project_manager_id !== undefined) {
      project.project_manager_id = extractObjectId(project_manager_id || project_manager);
    }
    if (start_date !== undefined) project.start_date = start_date || null;
    if (end_date !== undefined) project.end_date = end_date || null;
    if (working_days !== undefined) project.working_days = Number.isFinite(+working_days) ? +working_days : 0;
    if (man_days !== undefined) project.man_days = Number.isFinite(+man_days) ? +man_days : 0;
    if (hours_per_day !== undefined) project.hours_per_day = Number.isFinite(+hours_per_day) ? +hours_per_day : 8;
    if (use_manual_progress !== undefined) project.use_manual_progress = !!use_manual_progress;
    if (use_weighted_progress !== undefined) project.use_weighted_progress = !!use_weighted_progress;
    if (use_time_progress !== undefined) project.use_time_progress = !!use_time_progress;
    
    await project.save();
    
    res.json({
      done: true,
      body: {
         ...project.toObject(),
         id: project._id
      },
      message: "Project updated successfully"
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete project
 * @route   DELETE /api/projects/:id
 * @access  Private
 */
exports.delete = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        done: false,
        message: 'Project not found'
      });
    }
    
    project.is_archived = true;
    await project.save();
    
    res.json({
      done: true,
      message: 'Project archived successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get project overview/stats
 * @route   GET /api/projects/:id/overview
 * @access  Private
 */
exports.getOverview = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner_id', 'name email avatar_url');
    
    if (!project) {
      return res.status(404).json({ done: false, message: 'Project not found' });
    }

    const totalTasks = await Task.countDocuments({ project_id: project._id, is_archived: false });
    const completedTasks = await Task.countDocuments({ 
      project_id: project._id, 
      is_archived: false,
      status_id: { $in: await TaskStatus.find({ project_id: project._id, category: 'done' }).select('_id') }
    });

    const stats = {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      overdue_tasks: await Task.countDocuments({ 
        project_id: project._id, 
        is_archived: false, 
        due_date: { $lt: new Date() },
        status_id: { $nin: await TaskStatus.find({ project_id: project._id, category: 'done' }).select('_id') }
      })
    };
    
    res.json({
      done: true,
      body: {
        ...project.toObject(),
        id: project._id,
        ...stats
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add member to project
 * @route   POST /api/projects/:id/members
 * @access  Private (Owner/Admin only)
 */
exports.addMember = async (req, res, next) => {
  try {
    const { email, role } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let assignedRole = 'member'; 
    
    if (role && ['member', 'viewer'].includes(role)) {
      assignedRole = role;
    } else if (role === 'admin' && req.isProjectOwner) {
      assignedRole = 'admin';
    }

    const existing = await ProjectMember.findOne({
      project_id: req.params.id,
      user_id: user._id
    });

    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        existing.role = assignedRole;
        await existing.save();
      } else {
        return res.status(400).json({
          success: false,
          message: 'User is already a project member'
        });
      }
    } else {
      await ProjectMember.create({
        project_id: req.params.id,
        user_id: user._id,
        role: assignedRole
      });
    }

    res.status(201).json({
      done: true,
      body: {
        ...user.toObject(),
        role: assignedRole
      }
    });
  } catch (error) {
    next(error);
  }
};

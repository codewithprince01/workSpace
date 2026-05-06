const { Project, Task, TaskStatus, TimeLog, ActivityLog, ProjectComment, ProjectCategory, ProjectMember, Team, TeamMember, TaskPhase } = require('../models');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const cacheService = require('../services/cache.service');

/**
 * @desc    Get reporting info
 * @route   GET /api/reporting/info
 * @access  Private
 */
exports.getInfo = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('last_team_id', 'name');
    
    res.json({
      done: true,
      body: {
        organization_name: user?.last_team_id?.name || ''
      }
    });
  } catch (error) {
    logger.error('getInfo Error: %s', error.message);
    next(error);
  }
};

/**
 * @desc    Get reporting overview statistics
 * @route   GET /api/reporting/overview/statistics
 * @access  Private
 */
exports.getOverviewStatistics = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // 1. Teams Stats
    const myTeams = await TeamMember.find({ user_id: userId, is_active: true }).select('team_id');
    const teamIds = myTeams.map(t => t.team_id).filter(Boolean);
    
    const teamProjectsCount = await Project.countDocuments({ team_id: { $in: teamIds }, is_archived: false });
    const teamMembersCount = await TeamMember.distinct('user_id', { team_id: { $in: teamIds }, is_active: true });

    // 2. Projects Stats
    // Super admins viewing a switched org get ALL projects for that team;
    // normal users are scoped to their ProjectMember records.
    let projectIds;
    if (req.isSuperAdmin && req.superAdminActiveTeam) {
      const teamProjects = await Project.find({
        team_id: req.superAdminActiveTeam,
        is_archived: false
      }).select('_id');
      projectIds = teamProjects.map(p => p._id);
    } else {
      const myProjectMemberships = await ProjectMember.find({ user_id: userId, is_active: true }).select('project_id');
      projectIds = myProjectMemberships.map(m => m.project_id);
    }

    const totalProjects = projectIds.length;
    const activeProjects = await Project.countDocuments({ _id: { $in: projectIds }, status: 'active', is_archived: false });
    const overdueProjects = await Project.countDocuments({ 
        _id: { $in: projectIds }, 
        is_archived: false, 
        end_date: { $lt: now },
        status: { $ne: 'completed' }
    });

    // 3. Members/Task Stats (relevant to user's projects)
    const overdueTasks = await Task.countDocuments({ 
        project_id: { $in: projectIds }, 
        is_archived: false, 
        due_date: { $lt: now },
        status_id: { $nin: await TaskStatus.find({ project_id: { $in: projectIds }, category: 'done' }).distinct('_id') }
    });
    
    const unassignedTasks = await Task.countDocuments({
        project_id: { $in: projectIds },
        is_archived: false,
        $or: [{ assignees: { $exists: false } }, { assignees: { $size: 0 } }]
    });

    res.json({
        done: true,
        body: {
            teams: {
                count: teamIds.length,
                projects: teamProjectsCount,
                members: teamMembersCount.length
            },
            projects: {
                count: totalProjects,
                active: activeProjects,
                overdue: overdueProjects
            },
            members: {
                count: teamMembersCount.length,
                unassigned: unassignedTasks,
                overdue: overdueTasks
            }
        }
    });
  } catch (error) {
    logger.error('getOverviewStatistics Error: %s', error.message);
    next(error);
  }
};

/**
 * @desc    Get reporting overview teams
 * @route   GET /api/reporting/overview/teams
 * @access  Private
 */
exports.getOverviewTeams = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Find teams where user is a member
    const teamMemberships = await TeamMember.find({ user_id: userId, is_active: true })
        .populate('team_id', 'name color_code');
    
    const teamIds = teamMemberships.map(tm => tm.team_id?._id).filter(Boolean);

    // 2. Batch count projects across all teams
    const projectCountAgg = await Project.aggregate([
      { $match: { team_id: { $in: teamIds }, is_archived: false } },
      { $group: { _id: '$team_id', count: { $sum: 1 } } }
    ]);
    const projectCountMap = {};
    projectCountAgg.forEach(r => { projectCountMap[r._id.toString()] = r.count; });

    // 3. Batch fetch team members (limit 5 per team in JS for simplicity)
    const allMembers = await TeamMember.find({ team_id: { $in: teamIds }, is_active: true })
        .populate('user_id', 'name avatar_url email')
        .lean();

    const membersByTeam = {};
    allMembers.forEach(m => {
      const tid = m.team_id.toString();
      if (!membersByTeam[tid]) membersByTeam[tid] = [];
      if (membersByTeam[tid].length < 5 && m.user_id) {
        membersByTeam[tid].push({
          id: m.user_id._id,
          name: m.user_id.name,
          avatar_url: m.user_id.avatar_url,
          email: m.user_id.email
        });
      }
    });

    const teams = teamMemberships.map((tm) => {
        if (!tm.team_id) return null;
        const teamId = tm.team_id._id.toString();
        
        return {
            id: tm.team_id._id,
            name: tm.team_id.name,
            color_code: tm.team_id.color_code,
            projects_count: projectCountMap[teamId] || 0,
            members: membersByTeam[teamId] || []
        };
    }).filter(Boolean);

    res.json({
      done: true,
      body: teams
    });

  } catch (error) {
    logger.error('getOverviewTeams Error: %s', error.message);
    next(error);
  }
};

exports.getProjectsReports = async (req, res, next) => {
  try {
    logger.debug('Reporting Projects Body: %j', req.body);
    const { index, size, field, order, search, archived, statuses, healths, categories, project_managers, teams } = req.body;
    const userId = req.user._id;

    const page = parseInt(index) || 1;
    const limit = parseInt(size) || 10;
    const skip = (page - 1) * limit;

    // Get user's projects — super admins see all projects in the switched team
    let projectIds;
    if (req.isSuperAdmin && req.superAdminActiveTeam) {
      const teamProjects = await Project.find({
        team_id: req.superAdminActiveTeam
      }).select('_id');
      projectIds = teamProjects.map(p => p._id);
    } else {
      const memberships = await ProjectMember.find({ user_id: userId, is_active: true });
      logger.debug(`Found ${memberships.length} memberships for user ${userId}`);
      projectIds = memberships.map(m => m.project_id);
    }

    const query = { _id: { $in: projectIds } };
    
    // Filters
    if (!archived) query.is_archived = false;
    if (search) query.name = { $regex: search, $options: 'i' };
    
    // Status Filter 
    if (statuses && statuses.length > 0) query.status = { $in: statuses };
    
    if (healths && healths.length > 0) query.health = { $in: healths };
    if (categories && categories.length > 0) query.category_id = { $in: categories };

    // Teams Filter — filter by team_id
    if (teams && teams.length > 0) {
      const validTeamIds = teams
        .filter(id => id && mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (validTeamIds.length > 0) query.team_id = { $in: validTeamIds };
    }

    // Project Managers Filter — filter by owner_id
    if (project_managers && project_managers.length > 0) {
      const validManagerIds = project_managers
        .filter(id => id && mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (validManagerIds.length > 0) query.owner_id = { $in: validManagerIds };
    }

    logger.debug('Project Reports Filter Query: %j', query);

    const total = await Project.countDocuments(query);
    logger.debug(`Found ${total} total projects matching query`);

    const sort = {};
    if (field && order) {
        sort[field] = order === 'ascend' || order === 'asc' ? 1 : -1;
    } else {
        sort.name = 1;
    }

    const projects = await Project.find(query)
        .populate('category_id', 'name color_code')
        .populate('team_id', 'name color_code')
        .populate('owner_id', 'name avatar_url email') 
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

    const pIds = projects.map(p => p._id);

    // --- 1. Batch Fetch Statuses ---
    const allStatuses = await TaskStatus.find({ project_id: { $in: pIds } }).lean();
    const statusMapByProject = {}; // projectId -> { todo: [], doing: [], done: [] }
    allStatuses.forEach(s => {
      const pid = s.project_id.toString();
      if (!statusMapByProject[pid]) statusMapByProject[pid] = { todo: [], doing: [], done: [] };
      if (statusMapByProject[pid][s.category]) statusMapByProject[pid][s.category].push(s._id);
    });

    // --- 2. Batch Aggregate Tasks ---
    const taskStatsAgg = await Task.aggregate([
      { $match: { project_id: { $in: pIds }, is_archived: false } },
      { $group: {
          _id: '$project_id',
          total: { $sum: 1 },
          estHours: { $sum: '$estimated_hours' },
          actHours: { $sum: '$actual_hours' }
      }}
    ]);
    
    // For specific counts (todo/doing/done), we'll do a second agg or combined
    // Combined is better:
    const taskDetailsAgg = await Task.aggregate([
      { $match: { project_id: { $in: pIds }, is_archived: false } },
      { $group: {
          _id: { pid: '$project_id', sid: '$status_id' },
          count: { $sum: 1 }
      }}
    ]);

    const statsMap = {};
    taskStatsAgg.forEach(r => {
      statsMap[r._id.toString()] = { 
        total: r.total, 
        estHours: r.estHours || 0, 
        actHours: r.actHours || 0,
        todo: 0, doing: 0, done: 0
      };
    });

    taskDetailsAgg.forEach(r => {
      const pid = r._id.pid.toString();
      const sid = r._id.sid ? r._id.sid.toString() : null;
      if (!statsMap[pid]) return;
      
      const pStatusMap = statusMapByProject[pid];
      if (!pStatusMap) return;

      if (pStatusMap.done.some(id => id.toString() === sid)) statsMap[pid].done += r.count;
      else if (pStatusMap.doing.some(id => id.toString() === sid)) statsMap[pid].doing += r.count;
      else statsMap[pid].todo += r.count;
    });

    // --- 3. Batch Latest Activity & Comment ---
    const lastActivityAgg = await ActivityLog.aggregate([
      { $match: { project_id: { $in: pIds } } },
      { $sort: { created_at: -1 } },
      { $group: { _id: '$project_id', lastLog: { $first: '$$ROOT' } } }
    ]);
    const activityMap = {};
    lastActivityAgg.forEach(r => { activityMap[r._id.toString()] = r.lastLog; });

    const lastCommentAgg = await ProjectComment.aggregate([
      { $match: { project_id: { $in: pIds } } },
      { $sort: { created_at: -1 } },
      { $group: { _id: '$project_id', content: { $first: '$content' } } }
    ]);
    const commentMap = {};
    lastCommentAgg.forEach(r => { commentMap[r._id.toString()] = r.content; });

    // --- Helper formatting ---
    const getStatusInfo = (statusStr) => {
        switch(statusStr) {
            case 'active': return { name: 'Active', color_code: '#52c41a', icon: 'play-circle' };
            case 'on_hold': return { name: 'On Hold', color_code: '#faad14', icon: 'pause-circle' };
            case 'completed': return { name: 'Completed', color_code: '#1890ff', icon: 'check-circle' };
            case 'cancelled': return { name: 'Cancelled', color_code: '#ff4d4f', icon: 'stop' };
            default: return { name: statusStr || 'Unknown', color_code: '#d9d9d9', icon: 'question-circle' };
        }
    };

    const timeAgo = (date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    };

    // --- Final Enrichment ---
    const enrichedProjects = projects.map((p) => {
        const pid = p._id.toString();
        const stats = statsMap[pid] || { total: 0, estHours: 0, actHours: 0, todo: 0, doing: 0, done: 0 };
        
        const estimatedHours = p.estimated_hours || stats.estHours || 0;
        const actualHours = p.actual_hours || stats.actHours || 0;

        const now = new Date();
        const end = p.end_date ? new Date(p.end_date) : null;
        let daysLeft = null, isOverdue = false, isToday = false;
        if (end) {
            const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)); 
            if (diffDays < 0) isOverdue = true;
            else if (diffDays === 0) isToday = true;
            else daysLeft = diffDays;
        }
        
        const statusInfo = getStatusInfo(p.status);
        const lastActivityString = activityMap[pid] ? timeAgo(activityMap[pid].created_at) : 'No activity';

        return {
            id: p._id,
            name: p.name,
            color_code: p.color_code,
            status_id: p.status, 
            status_name: statusInfo.name,
            status_color: statusInfo.color_code,
            status_icon: statusInfo.icon,
            category_id: p.category_id?._id,
            category_name: p.category_id?.name,
            category_color: p.category_id?.color_code,
            team_id: p.team_id?._id,
            team_name: p.team_id?.name,
            start_date: p.start_date,
            end_date: p.end_date,
            days_left: daysLeft,
            is_overdue: isOverdue,
            is_today: isToday,
            project_health: p.health,
            health_color: getHealthColor(p.health),
            health_name: p.health,
            tasks_stat: {
                total: stats.total,
                todo: stats.todo,
                doing: stats.doing,
                done: stats.done
            },
            estimated_time: estimatedHours,
            actual_time: actualHours,
            estimated_time_string: formatHours(estimatedHours),
            actual_time_string: formatHours(actualHours),
            project_manager: {
                name: p.owner_id?.name,
                avatar_url: p.owner_id?.avatar_url
            },
            client: p.client_name || '', 
            last_activity: { last_activity_string: lastActivityString },
            comment: commentMap[pid] || ''
        };
    });

    res.json({
        done: true,
        body: {
            total,
            projects: enrichedProjects
        }
    });

  } catch (error) {
    logger.error('getProjectsReports Error: %s', error.message);
    next(error);
  }
};

/**
 * @desc    Get allocation timesheet
 * @route   POST /api/reporting/allocation
 * @access  Private
 */
exports.getAllocationData = async (req, res, next) => {
  try {
    const { teams, projects: projectIds, categories, duration, date_range, archived, billable } = req.body;
    const { archived: archivedQuery } = req.query; 

    logger.debug('getAllocationData called by user %s', req.user._id);
    logger.debug('getAllocationData body: %j', req.body);


    // 1. Build Project Filter
    const projectQuery = {};
    // Use $ne: true to include undefined, null, and false values
    if (archived === true) {
        projectQuery.is_archived = true;
    } else {
        projectQuery.is_archived = { $ne: true };
    }

    if (Array.isArray(projectIds) && projectIds.length > 0) {
        projectQuery._id = { $in: projectIds };
    }
    if (Array.isArray(categories) && categories.length > 0) {
        projectQuery.category_id = { $in: categories };
    }
    
    // Scope to user's allowed projects — super admins see all projects in the switched team
    const userId = req.user._id;
    let allowedProjectIds;
    if (req.isSuperAdmin && req.superAdminActiveTeam) {
      const teamProjects = await Project.find({
        team_id: req.superAdminActiveTeam
      }).select('_id');
      allowedProjectIds = teamProjects.map(p => p._id);
    } else {
      const memberships = await ProjectMember.find({ user_id: userId, is_active: true });
      allowedProjectIds = memberships.map(m => m.project_id);
      logger.debug(`User ${userId} has ${memberships.length} project memberships`);
    }
    
    // Then apply team filter if needed (but stay within user's allowed projects)
    if (Array.isArray(teams) && teams.length > 0) {
      logger.debug('Teams filter requested: %j', teams);
        // Find projects that match BOTH user membership AND team filter
        const teamProjects = await Project.find({ 
            _id: { $in: allowedProjectIds },
            team_id: { $in: teams }
        }).select('_id');
        const teamProjectIds = teamProjects.map(p => p._id);
        
        if (projectQuery._id) {
            const currentIds = projectQuery._id.$in || [];
            projectQuery._id = { $in: currentIds.filter(id => teamProjectIds.some(tid => tid.toString() === id.toString())) };
        } else {
            projectQuery._id = { $in: teamProjectIds };
        }
    } else {
        // No team filter, just use allowed projects
        if (projectQuery._id) {
            const currentIds = projectQuery._id.$in || [];
            projectQuery._id = { $in: currentIds.filter(id => allowedProjectIds.some(aid => aid.equals(id))) };
        } else {
            projectQuery._id = { $in: allowedProjectIds };
        }
    }

    
    const projects = await Project.find(projectQuery)
        .select('name color_code status team_id')
        .lean();
    
    logger.debug(`Found ${projects.length} matching projects.`);

    const finalProjectIds = projects.map(p => p._id);
    
    // 2. Build TimeLog Filter
    const timeLogQuery = {};
    const taskQuery = { project_id: { $in: finalProjectIds } };
    
    const tasks = await Task.find(taskQuery).select('_id project_id');
    const taskIdToProjectId = {};
    tasks.forEach(t => taskIdToProjectId[t._id.toString()] = t.project_id.toString());
    const taskIds = tasks.map(t => t._id);
    
    timeLogQuery.task_id = { $in: taskIds };

    if (Array.isArray(date_range) && date_range.length === 2 && date_range[0] && date_range[1]) {
        timeLogQuery.logged_date = {
            $gte: new Date(date_range[0]),
            $lte: new Date(date_range[1])
        };
    }

    const timeLogs = await TimeLog.find(timeLogQuery).populate('user_id', 'name');

    // 3. Aggregate
    const userMap = {}; 
    const projectUserMap = {}; 
    const projectTotalMap = {}; 

    timeLogs.forEach(log => {
        if (!log.user_id) return;
        
        const uid = log.user_id._id.toString();
        const pid = taskIdToProjectId[log.task_id.toString()];
        const minutes = (log.hours || 0) * 60; 

        if (!userMap[uid]) {
            userMap[uid] = { id: uid, name: log.user_id.name, total_minutes: 0 };
        }
        userMap[uid].total_minutes += minutes;

        if (!projectUserMap[pid]) projectUserMap[pid] = {};
        if (!projectUserMap[pid][uid]) projectUserMap[pid][uid] = 0;
        projectUserMap[pid][uid] += minutes;

        if (!projectTotalMap[pid]) projectTotalMap[pid] = 0;
        projectTotalMap[pid] += minutes;
    });

    const usersList = Object.values(userMap).sort((a, b) => a.name.localeCompare(b.name));
    
    const fmtTime = (mins) => {
        if (!mins) return "0h";
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    };

    // Build Projects Response
    const projectsResponse = projects.map(p => {
        const pid = p._id.toString();
        const pTotalMins = projectTotalMap[pid] || 0;
        
        const logs = usersList.map(u => {
            const mins = projectUserMap[pid]?.[u.id] || 0;
            return {
                time_logged: mins > 0 ? fmtTime(mins) : '-'
            };
        });

        const getStatusStyles = (s) => {
             switch(s) {
                 case 'active': return { icon: 'play-circle', color: '#52c41a' };
                 case 'completed': return { icon: 'check-circle', color: '#1890ff' };
                 default: return { icon: 'info-circle', color: '#888' };
             }
        }
        const style = getStatusStyles(p.status);

        return {
            id: pid,
            name: p.name,
            color_code: p.color_code || '#1890ff',
            status_icon: style.icon,
            status_color_code: style.color,
            progress: 0, 
            time_logs: logs,
            total: fmtTime(pTotalMins)
        };
    }).filter(p => true); 

    // Format users list
    const finalUsers = usersList.map(u => ({
        id: u.id,
        name: u.name,
        total_time: fmtTime(u.total_minutes)
    }));

    logger.debug(`Allocation response — projects: ${projectsResponse.length}, users: ${finalUsers.length}`);

    res.json({
        done: true,
        body: {
            projects: projectsResponse,
            users: finalUsers
        }
    });

  } catch (error) {
    logger.error('getAllocationData Error: %s', error.message);
    next(error);
  }
};

/**
 * @desc    Get reporting members
 * @route   POST /api/reporting/members
 * @access  Private
 */
// ...
exports.getMembersReports = async (req, res, next) => {
  try {
    const { index, size, field, order, search, archived, duration, date_range } = req.body;
    const userId = req.user._id;

    logger.debug('getMembersReports called by user %s', userId);

    const page = parseInt(index) || 1;
    const limit = parseInt(size) || 10;
    const skip = (page - 1) * limit;

    // ── Step 1: Get ALL teams the user belongs to ──────────────────────────
    const myMemberships = await TeamMember.find({ user_id: userId, is_active: true }).select('team_id');
    if (!myMemberships.length) {
      return res.json({ done: true, body: { total: 0, members: [] } });
    }
    const teamIds = myMemberships.map(m => m.team_id).filter(Boolean);

    // ── Step 2: Get all projects in those teams ─────────────────────────────
    const projects = await Project.find({ team_id: { $in: teamIds }, is_archived: archived ? undefined : false })
      .select('_id team_id name')
      .lean();
    const projectIds = projects.map(p => p._id);
    const projectTeamMap = {};
    projects.forEach(p => { projectTeamMap[p._id.toString()] = p.team_id?.toString(); });

    // ── Step 3: Get ALL project members across those projects ───────────────
    const projectMembers = await ProjectMember.find({
      project_id: { $in: projectIds },
      is_active: true,
    })
      .populate('user_id', 'name avatar_url email color_code')
      .lean();

    // ── Step 4: Deduplicate by user_id ─────────────────────────────────────
    const uniqueUsersMap = {};
    projectMembers.forEach(pm => {
      if (!pm.user_id) return;
      const uid = pm.user_id._id.toString();
      if (!uniqueUsersMap[uid]) {
        uniqueUsersMap[uid] = pm.user_id;
      }
    });

    let allUsers = Object.values(uniqueUsersMap);

    // ── Step 5: Apply search filter (by name) ──────────────────────────────
    if (search) {
      const q = search.toLowerCase();
      allUsers = allUsers.filter(u => (u.name || '').toLowerCase().includes(q));
    }

    // ── Step 6: Sort ───────────────────────────────────────────────────────
    const sortField = field || 'name';
    const sortDir = (order === 'asc' || order === 'ascend') ? 1 : -1;
    allUsers.sort((a, b) => {
      const av = (a[sortField] || '').toString().toLowerCase();
      const bv = (b[sortField] || '').toString().toLowerCase();
      return sortDir * av.localeCompare(bv);
    });

    const total = allUsers.length;

    // ── Step 7: Paginate ───────────────────────────────────────────────────
    const pagedUsers = allUsers.slice(skip, skip + limit);
    const pagedUserIds = pagedUsers.map(u => u._id);

    // ── Step 8: Batch Task Stats ───────────────────────────────────────────
    const taskQuery = { assignees: { $in: pagedUserIds }, is_archived: false };
    if (date_range && Array.isArray(date_range) && date_range.length === 2) {
      taskQuery.due_date = { $gte: new Date(date_range[0]), $lte: new Date(date_range[1]) };
    }
    const allTasks = await Task.find(taskQuery).select('assignees status_id due_date project_id').lean();

    const statusIds = [...new Set(allTasks.map(t => t.status_id?.toString()).filter(Boolean))];
    const statuses = await TaskStatus.find({ _id: { $in: statusIds } }).select('category').lean();
    const statusMap = {};
    statuses.forEach(s => { statusMap[s._id.toString()] = s.category; });

    const memberStatsMap = {};
    const now = new Date();
    allTasks.forEach(task => {
      task.assignees.forEach(uid => {
        const uidStr = uid.toString();
        if (!memberStatsMap[uidStr]) {
          memberStatsMap[uidStr] = { todo: 0, doing: 0, done: 0, overdue: 0, total: 0, projects: new Set() };
        }
        const stats = memberStatsMap[uidStr];
        stats.total++;
        if (task.project_id) stats.projects.add(task.project_id.toString());
        const cat = statusMap[task.status_id?.toString()] || 'todo';
        if (cat === 'done') stats.done++;
        else if (cat === 'doing') stats.doing++;
        else stats.todo++;
        if (task.due_date && new Date(task.due_date) < now && cat !== 'done') stats.overdue++;
      });
    });

    // ── Step 9: Build response ────────────────────────────────────────────
    const enrichedMembers = pagedUsers.map(u => {
      const uid = u._id.toString();
      const stats = memberStatsMap[uid] || { todo: 0, doing: 0, done: 0, overdue: 0, total: 0, projects: new Set() };
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        avatar_url: u.avatar_url,
        color_code: u.color_code || '#888',
        projects: stats.projects.size,
        tasks: stats.total,
        completed: stats.done,
        ongoing: stats.todo + stats.doing,
        overdue: stats.overdue,
        tasks_stat: {
          total: stats.total,
          todo: stats.todo,
          doing: stats.doing,
          done: stats.done,
        },
      };
    });

    res.json({
      done: true,
      body: { total, members: enrichedMembers },
    });

  } catch (error) {
    logger.error('getMembersReports Error: %s', error.message);
    next(error);
  }
};


/**
 * @desc    Get allocation categories
 * @route   POST /api/reporting/allocation/categories
 * @access  Private
 */
exports.getAllocationCategories = async (req, res, next) => {
  try {
    const teamIds = req.body; // Expecting array of strings
    if (!Array.isArray(teamIds)) {
        return res.json({ done: true, body: [] });
    }
    
    const categories = await ProjectCategory.find({ team_id: { $in: teamIds }, is_archived: false })
        .select('name color_code');

    const mapped = categories.map(c => ({
        id: c._id,
        name: c.name,
        color_code: c.color_code
    }));

    res.json({ done: true, body: mapped });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get allocation projects
 * @route   POST /api/reporting/allocation/projects
 * @access  Private
 */
exports.getAllocationProjects = async (req, res, next) => {
  try {
    const { selectedTeams, selectedCategories, noCategoryIncluded } = req.body;
    
    const query = { is_archived: false };
    if (selectedTeams && selectedTeams.length > 0) {
        query.team_id = { $in: selectedTeams };
    }
    
    // Category filter
    const catConditions = [];
    if (selectedCategories && selectedCategories.length > 0) {
        catConditions.push({ category_id: { $in: selectedCategories } });
    }
    if (noCategoryIncluded) {
        catConditions.push({ category_id: null });
    }
    
    if (catConditions.length > 0) {
        query.$or = catConditions;
    }

    const projects = await Project.find(query).select('name');
    const mapped = projects.map(p => ({
        id: p._id,
        name: p.name
    }));

    res.json({ done: true, body: mapped });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get projects time sheet
 * @route   POST /api/reporting/time-reports/projects
 * @access  Private
 */
exports.getTimeReportsProjects = async (req, res, next) => {
 try {
    const { teams, projects: projectIds, categories, duration, date_range, archived, billable } = req.body;


    // Reuse filter logic (simplifying here for speed, ideally shared helper)
    const projectQuery = {};
    // Use $ne: true to include undefined, null, and false values
    if (archived === true) {
        projectQuery.is_archived = true;
    } else {
        projectQuery.is_archived = { $ne: true };
    }

    if (Array.isArray(projectIds) && projectIds.length > 0) projectQuery._id = { $in: projectIds };
    if (Array.isArray(categories) && categories.length > 0) projectQuery.category_id = { $in: categories };
    if (Array.isArray(teams) && teams.length > 0) projectQuery.team_id = { $in: teams };
    
    const projects = await Project.find(projectQuery).select('name color_code');
    logger.debug(`getTimeReportsProjects: found ${projects.length} projects`);
    const pIds = projects.map(p => p._id);
    
    // TimeLogs
    const timeLogQuery = {};
    const taskQuery = { project_id: { $in: pIds } };
    const tasks = await Task.find(taskQuery).select('_id project_id');
    const tIds = tasks.map(t => t._id);
    const taskIdToProjectId = {};
    tasks.forEach(t => taskIdToProjectId[t._id.toString()] = t.project_id.toString());
    
    timeLogQuery.task_id = { $in: tIds };
    if (Array.isArray(date_range) && date_range.length === 2 && date_range[0] && date_range[1]) {
        timeLogQuery.logged_date = {
            $gte: new Date(date_range[0]),
            $lte: new Date(date_range[1])
        };
    }
    
    const timeLogs = await TimeLog.find(timeLogQuery);
    
    // Aggregate by Project
    const projStats = {};
    projects.forEach(p => {
        projStats[p._id.toString()] = { 
            name: p.name, 
            color_code: p.color_code || '#1890ff', 
            seconds: 0 
        };
    });
    
    timeLogs.forEach(log => {
        const pid = taskIdToProjectId[log.task_id.toString()];
        if (pid && projStats[pid]) {
            projStats[pid].seconds += (log.hours || 0) * 3600;
        }
    });

    const result = Object.values(projStats)
        .filter(p => p.seconds > 0) // Only relevant ones?
        .map(p => ({
            name: p.name,
            color_code: p.color_code,
            logged_time: p.seconds.toFixed(0) // Seconds string
        }))
        .sort((a, b) => parseFloat(b.logged_time) - parseFloat(a.logged_time));

    logger.debug(`Time reports projects — ${result.length} with time logs`);

    res.json({ done: true, body: result });

 } catch (error) {
     next(error);
 }
};

/**
 * @desc    Get members time sheet
 * @route   POST /api/reporting/time-reports/members
 * @access  Private
 */
exports.getTimeReportsMembers = async (req, res, next) => {
 try {
    const { teams, projects: projectIds, categories, duration, date_range, archived, billable } = req.body;
    
    // Need to filter by projects first?
    // Members time sheet usually shows all members in team/project scope.
    
    // ... logic similar to projects but group by User ID.

    // 1. Find Tasks of relevant projects
    const projectQuery = { is_archived: { $ne: true } };
    if (Array.isArray(projectIds) && projectIds.length) projectQuery._id = { $in: projectIds };
    const projects = await Project.find(projectQuery).select('_id');
    const pIds = projects.map(p => p._id);

    const tasks = await Task.find({ project_id: { $in: pIds } }).select('_id');
    const tIds = tasks.map(t => t._id);

    const timeLogQuery = { task_id: { $in: tIds } };
    if (Array.isArray(date_range) && date_range.length === 2 && date_range[0] && date_range[1]) {
        timeLogQuery.logged_date = {
            $gte: new Date(date_range[0]),
            $lte: new Date(date_range[1])
        };
    }

    const timeLogs = await TimeLog.find(timeLogQuery).populate('user_id', 'name avatar_url');
    
    const userStats = {};
    
    timeLogs.forEach(log => {
        if (!log.user_id) return;
        const uid = log.user_id._id.toString();
        if (!userStats[uid]) {
            userStats[uid] = {
                name: log.user_id.name,
                avatar_url: log.user_id.avatar_url,
                seconds: 0
            };
        }
        userStats[uid].seconds += (log.hours || 0) * 3600;
    });

    const result = Object.values(userStats)
        .map(u => ({
            name: u.name,
            color_code: '#1890ff', // Placeholder or user color
            logged_time: u.seconds.toFixed(0)
        }))
        .sort((a, b) => parseFloat(b.logged_time) - parseFloat(a.logged_time));
        
    res.json({ done: true, body: result });
 } catch (error) {
     next(error);
 }
};

/**
 * @desc    Get estimated vs actual
 * @route   POST /api/reporting/time-reports/estimated-vs-actual
 * @access  Private
 */
exports.getEstimatedVsActual = async (req, res, next) => {
 try {
    const { teams, projects: projectIds, categories, duration, date_range, archived } = req.body;

    const projectQuery = { is_archived: archived === true ? true : { $ne: true } };
    if (Array.isArray(projectIds) && projectIds.length) projectQuery._id = { $in: projectIds };
    if (Array.isArray(categories) && categories.length) projectQuery.category_id = { $in: categories };
    if (Array.isArray(teams) && teams.length) projectQuery.team_id = { $in: teams };

    const projects = await Project.find(projectQuery).select('name estimated_hours actual_hours color_code');
    logger.debug(`getEstimatedVsActual: found ${projects.length} projects`);
    
    // We might need to recalculate actual_hours from TimeLogs if date_range is provided.
    // If date_range is NOT provided, project.actual_hours is usually all time.
    
    let result = [];
    
    if (Array.isArray(date_range) && date_range.length === 2 && date_range[0] && date_range[1]) {
        // Must calculate from logs
        const pIds = projects.map(p => p._id);
        const tasks = await Task.find({ project_id: { $in: pIds } }).select('_id project_id');
        const tMap = {};
        tasks.forEach(t => tMap[t._id.toString()] = t.project_id.toString());
        
        const logs = await TimeLog.find({
            task_id: { $in: tasks.map(t => t._id) },
            logged_date: { $gte: new Date(date_range[0]), $lte: new Date(date_range[1]) }
        });
        
        const pMap = {};
        projects.forEach(p => pMap[p._id.toString()] = { 
            name: p.name, 
            est: p.estimated_hours || 0, // Est is confusing with date range? Usually Est is total.
            act: 0,
            color: p.color_code
        });
        
        logs.forEach(l => {
            const pid = tMap[l.task_id.toString()];
            if (pid && pMap[pid]) pMap[pid].act += (l.hours || 0);
        });
        
        result = Object.values(pMap).map(p => ({
            name: p.name,
            estimated_time: (p.est * 3600).toFixed(0),
            logged_time: (p.act * 3600).toFixed(0),
            color_code: p.color
        }));

    } else {
        result = projects.map(p => ({
            name: p.name,
            estimated_time: ((p.estimated_hours || 0) * 3600).toFixed(0),
            logged_time: ((p.actual_hours || 0) * 3600).toFixed(0),
            color_code: p.color_code
        }));
    }
    
    console.log(`\n=== ESTIMATED VS ACTUAL RESPONSE ===`);
    console.log(`Projects: ${result.length}`);
    console.log(`====================================\n`);
    
    res.json({ done: true, body: result });

 } catch (error) {
     next(error);
 }
};

/**
 * @desc    Get project overview info
 * @route   GET /api/reporting/overview/project/info/:id
 * @access  Private
 */
exports.getProjectOverviewInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id).lean();
    if (!project) return res.status(404).json({ done: false, message: 'Project not found' });

    const tasks = await Task.find({ project_id: id, is_archived: false }).lean();
    const statuses = await TaskStatus.find({ project_id: id }).lean();
    
    // Stats
    const totalCount = tasks.length;
    const findStatusIds = (cat) => statuses.filter(s => s.category === cat).map(s => s._id.toString());
    const doneIds = findStatusIds('done');
    const doingIds = findStatusIds('doing');
    
    const completed = tasks.filter(t => doneIds.includes(t.status_id?.toString())).length;
    const incompleted = totalCount - completed;
    const now = new Date();
    const overdue = tasks.filter(t => !doneIds.includes(t.status_id?.toString()) && t.due_date && new Date(t.due_date) < now).length;

    // Time
    const totalAllocated = project.estimated_hours || tasks.reduce((acc, t) => acc + (t.estimated_hours || 0), 0);
    const totalLogged = project.actual_hours || tasks.reduce((acc, t) => acc + (t.actual_hours || 0), 0);

    // By Status
    const todo = tasks.filter(t => !doneIds.includes(t.status_id?.toString()) && !doingIds.includes(t.status_id?.toString())).length;
    const doing = tasks.filter(t => doingIds.includes(t.status_id?.toString())).length;
    
    // By Priority
    const pLow = tasks.filter(t => t.priority === 'low' || t.priority === 0).length;
    const pMed = tasks.filter(t => t.priority === 'medium' || t.priority === 1).length;
    const pHigh = tasks.filter(t => t.priority === 'high' || t.priority === 2 || t.priority === 'urgent' || t.priority === 3).length;

    // By Due
    const upcoming = tasks.filter(t => !doneIds.includes(t.status_id?.toString()) && t.due_date && new Date(t.due_date) >= now).length;
    const noDue = tasks.filter(t => !t.due_date).length;

    const response = {
        stats: { 
            completed, 
            incompleted, 
            overdue, 
            total_allocated: formatHours(totalAllocated), 
            total_logged: formatHours(totalLogged) 
        },
        by_status: {
            all: totalCount, todo, doing, done: completed,
            chart: [
                { name: 'Todo', color: '#8c8c8c', y: todo },
                { name: 'Doing', color: '#1890ff', y: doing },
                { name: 'Done', color: '#52c41a', y: completed }
            ]
        },
        by_priority: {
            all: totalCount, low: pLow, medium: pMed, high: pHigh,
            chart: [
                { name: 'Low', color: '#52c41a', y: pLow },
                { name: 'Medium', color: '#faad14', y: pMed },
                { name: 'High', color: '#ff4d4f', y: pHigh }
            ]
        },
        by_due: {
            all: totalCount, completed, upcoming, overdue, no_due: noDue,
            chart: [
                { name: 'Completed', color: '#52c41a', y: completed },
                { name: 'Upcoming', color: '#1890ff', y: upcoming },
                { name: 'Overdue', color: '#ff4d4f', y: overdue },
                { name: 'No Due Date', color: '#8c8c8c', y: noDue }
            ]
        }
    };

    res.json({ done: true, body: response });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get project overview members
 * @route   GET /api/reporting/overview/project/members/:id
 * @access  Private
 */
exports.getProjectOverviewMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const projectMembers = await ProjectMember.find({ project_id: id, is_active: true })
        .populate('user_id', 'name avatar_url color_code')
        .lean();
    
    const tasks = await Task.find({ project_id: id, is_archived: false }).lean();
    const statuses = await TaskStatus.find({ project_id: id }).lean();
    const doneIds = statuses.filter(s => s.category === 'done').map(s => s._id.toString());
    const now = new Date();

    const membersRes = projectMembers.map(pm => {
        if (!pm.user_id) return null;
        const uid = pm.user_id._id.toString();
        const userTasks = tasks.filter(t => t.assignees?.some(a => a.toString() === uid));
        
        const tasksCount = userTasks.length;
        const comp = userTasks.filter(t => doneIds.includes(t.status_id?.toString())).length;
        const incomp = tasksCount - comp;
        const ovrd = userTasks.filter(t => !doneIds.includes(t.status_id?.toString()) && t.due_date && new Date(t.due_date) < now).length;
        
        return {
            id: pm._id,
            name: pm.user_id.name,
            tasks_count: tasksCount,
            completed: comp,
            incompleted: incomp,
            overdue: ovrd,
            contribution: tasksCount > 0 ? Math.round((comp / tasksCount) * 100) : 0,
            progress: tasksCount > 0 ? Math.round((comp / tasksCount) * 100) : 0,
            time_logged: formatHours(userTasks.reduce((acc, t) => acc + (t.actual_hours || 0), 0))
        };
    }).filter(Boolean);

    res.json({ done: true, body: membersRes });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get project overview tasks
 * @route   GET /api/reporting/overview/project/tasks/:id
 * @access  Private
 */
exports.getProjectOverviewTasks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { group } = req.query;

    const tasks = await Task.find({ project_id: id, is_archived: false })
        .populate('status_id', 'name color_code category')
        .populate('phase_id', 'name color_code')
        .populate('assignees', 'name avatar_url')
        .populate('labels', 'name color_code')
        .sort({ created_at: -1 })
        .lean();

    const statuses = await TaskStatus.find({ project_id: id }).sort({ sort_order: 1 }).lean();
    const phases = await TaskPhase.find({ project_id: id }).lean();
    
    const now = dayjs();

    const formatTask = (t) => {
        const est = t.estimated_hours || 0;
        const act = t.actual_hours || 0;
        const over = act > est ? act - est : 0;
        
        let overdue_days = 0;
        if (t.due_date && !t.completed_at) {
            const due = dayjs(t.due_date);
            if (due.isBefore(now)) {
                overdue_days = now.diff(due, 'day');
            }
        }

        return {
            id: t._id,
            name: t.name,
            key: t.task_key,
            sub_tasks_count: t.sub_tasks_count || 0,
            
            priority_name: getPriorityName(t.priority),
            priority_color: getPriorityColor(t.priority),
            
            status_name: t.status_id?.name || 'Unknown',
            status_color: t.status_id?.color_code || '#d9d9d9',
            
            phase_name: t.phase_id?.name || '-',
            phase_color: t.phase_id?.color_code || 'transparent',
            
            end_date: t.due_date,
            completed_at: t.completed_at,
            overdue_days: overdue_days > 0 ? overdue_days : '-',
            
            total_time_string: formatHours(est),
            time_spent_string: formatHours(act),
            overlogged_time_string: over > 0 ? formatHours(over) : '-'
        };
    };

    let resultGroups = [];

    if (group === 'priority') {
        const pOptions = [
            { id: 'high', name: 'High', color: '#f37070', val: 2 },
            { id: 'medium', name: 'Medium', color: '#faad14', val: 1 },
            { id: 'low', name: 'Low', color: '#52c41a', val: 0 },
            { id: 'none', name: 'None', color: '#d9d9d9', val: null }
        ];
        resultGroups = pOptions.map(p => ({
            id: p.id,
            name: p.name,
            color_code: p.color,
            tasks: tasks.filter(t => (p.val === null ? !t.priority : t.priority === p.val)).map(formatTask)
        }));
    } else if (group === 'phase') {
        resultGroups = phases.map(p => ({
            id: p._id,
            name: p.name,
            color_code: p.color_code,
            tasks: tasks.filter(t => t.phase_id?.toString() === p._id.toString()).map(formatTask)
        }));
        const unmapped = tasks.filter(t => !t.phase_id).map(formatTask);
        if (unmapped.length) resultGroups.push({ id: 'unmapped', name: 'Unmapped', color_code: '#d9d9d9', tasks: unmapped });
    } else {
        resultGroups = statuses.map(s => ({
          id: s._id,
          name: s.name,
          color_code: s.color_code,
          tasks: tasks.filter(t => t.status_id?._id?.toString() === s._id.toString()).map(formatTask)
        }));
    }

    res.json({ done: true, body: resultGroups.filter(g => g.tasks.length > 0) });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get allocation data for time sheet overview
 * @route   POST /api/reporting/allocation
 * @access  Private
 */
exports.getAllocationData = async (req, res, next) => {
  try {
    const { teams, projects, categories, duration, date_range, archived, billable } = req.body;
    const userId = req.user._id;

    // 1. Determine date range from duration if prompt provided
    let startDate, endDate;
    const now = dayjs();

    if (date_range && Array.isArray(date_range) && date_range.length === 2) {
      startDate = dayjs(date_range[0]).startOf('day').toDate();
      endDate = dayjs(date_range[1]).endOf('day').toDate();
    } else if (duration) {
      switch (duration) {
        case 'today':
          startDate = now.startOf('day').toDate();
          endDate = now.endOf('day').toDate();
          break;
        case 'yesterday':
          startDate = now.subtract(1, 'day').startOf('day').toDate();
          endDate = now.subtract(1, 'day').endOf('day').toDate();
          break;
        case 'this_week':
          startDate = now.startOf('week').toDate();
          endDate = now.endOf('week').toDate();
          break;
        case 'last_week':
          startDate = now.subtract(1, 'week').startOf('week').toDate();
          endDate = now.subtract(1, 'week').endOf('week').toDate();
          break;
        case 'this_month':
          startDate = now.startOf('month').toDate();
          endDate = now.endOf('month').toDate();
          break;
        case 'last_month':
          startDate = now.subtract(1, 'month').startOf('month').toDate();
          endDate = now.subtract(1, 'month').endOf('month').toDate();
          break;
        case 'this_year':
          startDate = now.startOf('year').toDate();
          endDate = now.endOf('year').toDate();
          break;
        default:
          // Stay undefined if no match
      }
    }

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.created_at = { $gte: startDate, $lte: endDate };
    }

    // 2. Get user's visible projects
    // Scoped to projects where the user is a member OR they own the team (admin/owner)
    const teamMemberships = await TeamMember.find({ user_id: userId, is_active: true }).select('team_id');
    const myTeamIds = teamMemberships.map(tm => tm.team_id).filter(Boolean);

    const projectMemberships = await ProjectMember.find({ user_id: userId, is_active: true }).select('project_id');
    const myProjectIds = projectMemberships.map(m => m.project_id).filter(Boolean);

    // Initial project query: visible projects in my teams
    const pQuery = {
      $or: [
        { _id: { $in: myProjectIds } },
        { team_id: { $in: myTeamIds } } // Assuming team members can see projects in their team (or filter by role if needed)
      ]
    };

    if (!archived) pQuery.is_archived = false;
    if (teams && teams.length) pQuery.team_id = { $in: teams };
    if (projects && projects.length) pQuery._id = { $in: projects };
    if (categories && categories.length) pQuery.category_id = { $in: categories };

    const matchingProjects = await Project.find(pQuery)
      .populate('status_id', 'name color_code')
      .select('name color_code status_id project_health')
      .lean();

    const finalProjectIds = matchingProjects.map(p => p._id);
    
    // 3. Get members who have logs in this range OR are in these projects
    // To keep it focused, let's get members with logs in the selected range for these projects
    const logs = await TimeLog.find({
      project_id: { $in: finalProjectIds },
      ...dateFilter
    }).populate('user_id', 'name avatar_url').lean();

    // Collect all users who have logs
    const usersMap = new Map();
    logs.forEach(log => {
      if (log.user_id && !usersMap.has(log.user_id._id.toString())) {
        usersMap.set(log.user_id._id.toString(), log.user_id);
      }
    });

    // If no logs, fallback to project members if date range is NOT set
    if (usersMap.size === 0 && !startDate) {
        const pMembers = await ProjectMember.find({ project_id: { $in: finalProjectIds }, is_active: true })
            .populate('user_id', 'name avatar_url')
            .lean();
        pMembers.forEach(pm => {
            if (pm.user_id && !usersMap.has(pm.user_id._id.toString())) {
                usersMap.set(pm.user_id._id.toString(), pm.user_id);
            }
        });
    }

    const users = Array.from(usersMap.values());

    // 4. Aggregate logs into projects grid
    let responseProjects = matchingProjects.map(p => {
      const pLogs = logs.filter(l => l.project_id.toString() === p._id.toString());
      let projectTotal = 0;
      
      const time_logs = users.map(u => {
        const userLogs = pLogs.filter(l => l.user_id && l.user_id._id.toString() === u._id.toString());
        const hours = userLogs.reduce((acc, l) => acc + (l.hours || 0), 0);
        projectTotal += hours;
        return { time_logged: formatHours(hours) };
      });

      return {
        id: p._id,
        name: p.name,
        color_code: p.color_code,
        status_color_code: p.status_id?.color_code || '#8c8c8c',
        status_icon: 'bi bi-circle-fill',
        progress: 0,
        time_logs,
        total: formatHours(projectTotal),
        totalHours: projectTotal // for filtering
      };
    });

    // CRITICAL: If a duration/date range is used, only show projects that have logs
    if (startDate || (projects && projects.length)) {
      // If user specifically filtered projects, show them. 
      // Otherwise, filter out projects with zero logs in this range.
      if (!projects || projects.length === 0) {
        responseProjects = responseProjects.filter(p => p.totalHours > 0);
      }
    }

    const responseUsers = users.map(u => {
      const uLogs = logs.filter(l => l.user_id && l.user_id._id.toString() === u._id.toString());
      const totalHours = uLogs.reduce((acc, l) => acc + (l.hours || 0), 0);
      return {
        id: u._id,
        name: u.name,
        total_time: formatHours(totalHours)
      };
    });

    res.json({
      done: true,
      body: {
        projects: responseProjects,
        users: responseUsers
      }
    });

  } catch (error) {
    logger.error('getAllocationData Error: %s', error.message);
    next(error);
  }
};

/**
 * @desc    Get allocation categories
 */
exports.getAllocationCategories = async (req, res, next) => {
    try {
        const categories = await ProjectCategory.find().select('name color_code').lean();
        res.json({ done: true, body: categories });
    } catch (error) { next(error); }
};

/**
 * @desc    Get allocation projects
 */
exports.getAllocationProjects = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const memberships = await ProjectMember.find({ user_id: userId, is_active: true }).select('project_id');
        const projects = await Project.find({ _id: { $in: memberships.map(m => m.project_id) }, is_archived: false }).select('name color_code').lean();
        res.json({ done: true, body: projects });
    } catch (error) { next(error); }
};

/**
 * @desc    Time Reports Projects
 */
exports.getTimeReportsProjects = async (req, res, next) => {
    try {
        const { archived } = req.body;
        const userId = req.user._id;
        const memberships = await ProjectMember.find({ user_id: userId, is_active: true }).select('project_id');
        const query = { _id: { $in: memberships.map(m => m.project_id) } };
        if (!archived) query.is_archived = false;

        const projects = await Project.find(query).select('name color_code').lean();
        res.json({ done: true, body: projects });
    } catch (error) { next(error); }
};

/**
 * @desc    Time Reports Members
 */
exports.getTimeReportsMembers = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const memberships = await TeamMember.find({ user_id: userId, is_active: true }).select('team_id');
        const teamIds = memberships.map(m => m.team_id);
        const members = await TeamMember.find({ team_id: { $in: teamIds }, is_active: true }).populate('user_id', 'name avatar_url').lean();
        res.json({ done: true, body: members.map(m => m.user_id) });
    } catch (error) { next(error); }
};

/**
 * @desc    Estimated Vs Actual
 */
exports.getEstimatedVsActual = async (req, res, next) => {
    try {
        res.json({ done: true, body: [] }); // Stub
    } catch (error) { next(error); }
};

function getPriorityName(p) {
    if (p === 0 || p === 'low') return 'Low';
    if (p === 1 || p === 'medium') return 'Medium';
    if (p === 2 || p === 'high') return 'High';
    if (p === 3 || p === 'urgent') return 'Urgent';
    return '-';
}

function getPriorityColor(p) {
    if (p === 0 || p === 'low') return '#52c41a';
    if (p === 1 || p === 'medium') return '#faad14';
    if (p === 2 || p === 'high') return '#f37070';
    if (p === 3 || p === 'urgent') return '#f5222d';
    return 'transparent';
}

// Helper functions (existing)
async function getStatusIdsByCategory(projectId, category) {
   // This would be expensive in loop. Better to fetch all statuses once or use aggregation.
   // For now, simple return [] to avoid crash, or fetch all TaskStatus with category.
   const statuses = await TaskStatus.find({ project_id: projectId, category: category }).select('_id');
   return statuses.map(s => s._id);
}

const dayjs = require('dayjs');

// ... (exports.getInfo, etc.)

/**
 * @desc    Get tasks reporting data
 * @route   POST /api/reporting/tasks
 * @access  Private
 */
exports.getTasksReports = async (req, res, next) => {
  try {
    const { 
        index, size, field, order, search, 
        projects: projectIds, teams: teamIds, statuses: statusIds, 
        priorities, project_managers, archived, categories 
    } = req.body;
    
    const userId = req.user._id;
    const page = parseInt(index) || 1;
    console.log('--- PRIORITY FILTER DEBUG ---');
    console.log('Received Priorities:', priorities);
    console.log('---------------------------');
    const limit = parseInt(size) || 10;
    const skip = (page - 1) * limit;

    // 1. Determine which projects the user can see
    const memberships = await ProjectMember.find({ user_id: userId, is_active: true }).select('project_id');
    const allowedProjectIds = memberships.map(m => m.project_id);

    // 2. Build Project Filter first (to narrow down tasks)
    const pQuery = { _id: { $in: allowedProjectIds } };
    if (!archived) pQuery.is_archived = false;
    if (teamIds && teamIds.length) pQuery.team_id = { $in: teamIds };
    if (categories && categories.length) pQuery.category_id = { $in: categories };
    
    // Project Manager filter (if needed, but for now we prioritize Task Assignee filter)
    // if (project_managers && project_managers.length) pQuery.owner_id = { $in: project_managers.filter(id => id !== 'unassigned') };

    const matchingProjects = await Project.find(pQuery).select('_id name color_code').lean();
    const finalProjectIds = matchingProjects.map(p => p._id);

    // 3. Build Task Filter
    const query = { project_id: { $in: finalProjectIds }, is_archived: false };
    
    if (search) {
        query.name = { $regex: search, $options: 'i' };
    }
    if (projectIds && projectIds.length) {
        const fids = finalProjectIds.map(fid => String(fid));
        query.project_id = { $in: projectIds.filter(id => fids.includes(String(id))) };
    }
    if (statusIds && statusIds.length) {
        // Since we send status names as IDs to the frontend for unified filtering,
        // we must resolve those names back into real status ObjectIds.
        const actualStatuses = await TaskStatus.find({ 
            project_id: { $in: finalProjectIds },
            name: { $in: statusIds }
        }).select('_id');
        query.status_id = { $in: actualStatuses.map(s => s._id) };
    }
    if (priorities && priorities.length) {
        const priorityMaps = {
            '3': 'urgent', '2': 'high', '1': 'medium', '0': 'low',
            3: 'urgent', 2: 'high', 1: 'medium', 0: 'low'
        };
        const normalizedPriorities = priorities.map(p => priorityMaps[p] || p);
        query.priority = { $in: normalizedPriorities };
    }

    // 4. Assignee Filter (Applied to tasks)
    if (project_managers && project_managers.length) {
        const hasUnassigned = project_managers.includes('unassigned');
        const realUserIds = project_managers.filter(id => id !== 'unassigned');
        
        const assigneeFilter = [];
        if (realUserIds.length) {
            assigneeFilter.push({ assignees: { $in: realUserIds } });
        }
        if (hasUnassigned) {
            assigneeFilter.push({ $or: [{ assignees: { $exists: false } }, { assignees: { $size: 0 } }] });
        }
        
        if (assigneeFilter.length > 1) {
            query.$or = assigneeFilter;
        } else if (assigneeFilter.length === 1) {
            // Merge with existing query
            Object.assign(query, assigneeFilter[0]);
        }
    }

    // 4. Counts for Stat Cards and Pagination
    const now = new Date();
    const statsQuery = { project_id: { $in: finalProjectIds }, is_archived: false };
    
    // Status Categories
    const allStatusesInScope = await TaskStatus.find({ project_id: { $in: finalProjectIds } }).select('category').lean();
    const doneStatusIds = allStatusesInScope.filter(s => s.category === 'done').map(s => s._id);
    const inProgressStatusIds = allStatusesInScope.filter(s => s.category === 'doing').map(s => s._id);

    const [totalFiltered, completed, inProgress, overdue, unassigned, dueThisWeek, totalAllScope] = await Promise.all([
        Task.countDocuments(query), // For pagination
        Task.countDocuments({ ...statsQuery, status_id: { $in: doneStatusIds } }),
        Task.countDocuments({ ...statsQuery, status_id: { $in: inProgressStatusIds } }),
        Task.countDocuments({ 
            ...statsQuery, 
            due_date: { $lt: now }, 
            status_id: { $nin: doneStatusIds } 
        }),
        Task.countDocuments({ 
            ...statsQuery, 
            $or: [{ assignees: { $exists: false } }, { assignees: { $size: 0 } }] 
        }),
        Task.countDocuments({ 
            ...statsQuery, 
            due_date: { 
                $gte: dayjs().startOf('week').toDate(), 
                $lte: dayjs().endOf('week').toDate() 
            } 
        }),
        Task.countDocuments(statsQuery)
    ]);

    const sort = {};
    if (field && order) {
        sort[field] = order === 'ascend' || order === 'asc' ? 1 : -1;
    } else {
        sort.created_at = -1;
    }

    // 5. Fetch Tasks
    const tasks = await Task.find(query)
        .populate('project_id', 'name color_code')
        .populate('status_id', 'name color_code category')
        .populate('assignees', 'name avatar_url email')
        .populate('phase_id', 'name')
        .populate('labels', 'name color_code')
        .populate('subtasks_count') // Use the virtual for exact count
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true });

    // 5. Build a map for subtasks details if needed for calculation
    const taskIds = tasks.map(t => t._id);
    const subtaskDetailQuery = { 
        parent_task_id: { $in: taskIds }, 
        is_archived: false, 
        is_trashed: { $ne: true } 
    };
    const activeSubtasks = await Task.find(subtaskDetailQuery).select('parent_task_id completed_at name').lean();

    const priorityList = [
        { id: 'urgent', name: 'Urgent', color: '#880808', slug: 'urgent' },
        { id: 'high', name: 'High', color: '#ff4d4f', slug: 'high' },
        { id: 'medium', name: 'Medium', color: '#faad14', slug: 'medium' },
        { id: 'low', name: 'Low', color: '#52c41a', slug: 'low' }
    ];

    // 6. Enrichment
    const enrichedTasks = tasks.map(task => {
        let daysOverdue = 0;
        if (!task.completed_at && task.due_date) {
            const due = new Date(task.due_date);
            const now = new Date();
            if (due < now) {
                daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
            }
        }

        const overloggedTime = Math.max(0, (task.actual_hours || 0) - (task.estimated_hours || 0));
        
        // Progress calculation based on EXACT matching of ACTIVE subtasks
        let progress = task.progress || 0;
        const mySubtasks = activeSubtasks.filter(st => st.parent_task_id.toString() === task._id.toString());
        
        if (mySubtasks.length > 0) {
            // IF SUBTASKS EXIST: Progress = (Completed Active Subtasks / Total Active Subtasks)
            const completedCount = mySubtasks.filter(st => !!st.completed_at).length;
            progress = Math.round((completedCount / mySubtasks.length) * 100);
        } else {
            // IF NO SUBTASKS: Progress = 100 if Done, else use the manual progress field
            if (task.status_id?.category === 'done') {
                progress = 100;
            } else {
                progress = task.progress || 0;
            }
        }

        const subtasksData = mySubtasks.map(st => ({
            title: st.name,
            completed: !!st.completed_at
        }));

        return {
            id: task._id,
            parent_task_id: task.parent_task_id || null,
            key: task.task_key || '-',
            name: task.name || '-',
            project_id: task.project_id?._id || null,
            project_name: task.project_id?.name || '-',
            project_color: task.project_id?.color_code || '#8c8c8c',
            status_id: task.status_id?._id || null,
            status_name: task.status_id?.name || '-',
            status_category: task.status_id?.category || 'todo',
            status_color: task.status_id?.color_code || task.status_id?.color || (task.status_id?.category === 'done' ? '#52c41a' : task.status_id?.category === 'doing' ? '#1890ff' : '#8c8c8c'),
            priority: task.priority ?? 1,
            priority_label: priorityList.find(p => p.id === task.priority || p.slug === task.priority)?.name || 'Medium',
            priority_color: priorityList.find(p => p.id === task.priority || p.slug === task.priority)?.color || '#faad14',
            assignees: (task.assignees || []).map(u => ({
                id: u._id,
                name: u.name || 'Unknown',
                avatar_url: u.avatar_url || null
            })),
            start_date: task.start_date || null,
            due_date: task.due_date || null,
            created_at: task.created_at || null,
            completed_at: task.completed_at || null,
            updated_at: task.updated_at || null,
            days_overdue: daysOverdue,
            estimated_time: task.estimated_hours || 0,
            estimated_time_string: formatHours(task.estimated_hours),
            logged_time: task.actual_hours || 0,
            logged_time_string: formatHours(task.actual_hours),
            overlogged_time: overloggedTime,
            overlogged_time_string: formatHours(overloggedTime),
            phase_id: task.phase_id?._id || null,
            phase_name: task.phase_id?.name || '-',
            labels: (task.labels || []).map(l => ({ 
                name: l.name || '-', 
                color: l.color_code || '#333' 
            })),
            progress: progress,
            subtasks: subtasksData,
            subtask_count: subtasksData.length // Exactly from active list
        };
    });

    res.json({
        done: true,
        body: {
            total: totalFiltered,
            stats: {
                total: totalAllScope,
                completed,
                inProgress,
                overdue,
                unassigned,
                dueThisWeek
            },
            tasks: enrichedTasks
        }
    });

  } catch (error) {
    logger.error('getTasksReports Error: %s', error.message);
    next(error);
  }
};

// --- Helpers ---

function getPriorityColor(priority) {
    switch(priority) {
        case 2: return '#ff4d4f'; // High (Red)
        case 1: return '#faad14'; // Medium (Yellow)
        case 0: return '#52c41a'; // Low (Green)
        default: return '#d9d9d9';
    }
}

function getHealthColor(health) {
    switch(health) {
        case 'good': return '#52c41a';
        case 'at_risk': return '#faad14';
        case 'critical': return '#ff4d4f';
        default: return '#d9d9d9';
    }
}

function formatHours(hours) {
    if (!hours) return '0h';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

/**
 * @desc    Get filters for tasks reporting
 * @route   GET /api/reporting/tasks/filters
 * @access  Private
 */
exports.getTasksReportingFilters = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Teams
    const teamMemberships = await TeamMember.find({ user_id: userId, is_active: true }).populate('team_id', 'name color_code');
    const teams = teamMemberships.map(tm => tm.team_id).filter(Boolean);

    // 2. Projects
    const projectMemberships = await ProjectMember.find({ user_id: userId, is_active: true }).select('project_id');
    const allowedProjectIds = projectMemberships.map(m => m.project_id);
    const projects = await Project.find({ _id: { $in: allowedProjectIds }, is_archived: false }).select('name color_code team_id owner_id category_id').lean();

    // 3. Statuses (Distinct names/ids across allowed projects)
    const statuses = await TaskStatus.find({ project_id: { $in: allowedProjectIds } }).select('name color_code category').lean();
    
    // Group statuses by name to avoid duplicates across projects
    const uniqueStatusesMap = new Map();
    statuses.forEach(s => {
        if (!uniqueStatusesMap.has(s.name)) {
            uniqueStatusesMap.set(s.name, s);
        }
    });
    const uniqueStatuses = Array.from(uniqueStatusesMap.values());

    // 4. Priorities
    const priorities = [
        { id: 'urgent', name: 'Urgent', color: '#880808' },
        { id: 'high', name: 'High', color: '#ff4d4f' },
        { id: 'medium', name: 'Medium', color: '#faad14' },
        { id: 'low', name: 'Low', color: '#52c41a' }
    ];

    // 5. Assignees (All members of all teams the user is in)
    const allTeamMembers = await TeamMember.find({ 
        team_id: { $in: teams.map(t => t._id) }, 
        is_active: true 
    })
    .populate('user_id', 'name avatar_url')
    .lean();
    
    const uniqueAssigneesMap = new Map();
    allTeamMembers.forEach(m => {
        if (m.user_id && !uniqueAssigneesMap.has(m.user_id._id.toString())) {
            uniqueAssigneesMap.set(m.user_id._id.toString(), {
                id: m.user_id._id,
                name: m.user_id.name,
                avatar_url: m.user_id.avatar_url
            });
        }
    });

    res.json({
        done: true,
        body: {
            teams: teams.map(t => ({ id: t._id, name: t.name, color: t.color_code })),
            projects: projects.map(p => ({ id: p._id, name: p.name, color: p.color_code, team_id: p.team_id })),
            statuses: uniqueStatuses.map(s => ({ id: s.name, name: s.name, color: s.color_code, category: s.category })), // Use name as ID for consistent name-based filtering
            priorities,
            project_managers: Array.from(uniqueAssigneesMap.values()),
            categories: []
        }
    });

  } catch (error) {
    logger.error('getTasksReportingFilters Error: %s', error.message);
    next(error);
  }
};

/**
 * @desc    Get filters for projects reporting
 * @route   GET /api/reporting/projects/filters
 * @access  Private
 */
exports.getProjectsReportingFilters = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Teams
    const teamMemberships = await TeamMember.find({ user_id: userId, is_active: true }).populate('team_id', 'name color_code');
    const teams = teamMemberships.map(tm => tm.team_id).filter(Boolean);

    // 2. Project Managers
    const projectMemberships = await ProjectMember.find({ user_id: userId, is_active: true }).select('project_id');
    const allowedProjectIds = projectMemberships.map(m => m.project_id);
    const projects = await Project.find({ _id: { $in: allowedProjectIds }, is_archived: false }).select('owner_id').populate('owner_id', 'name avatar_url');
    
    const managersMap = new Map();
    projects.forEach(p => {
        if (p.owner_id && !managersMap.has(p.owner_id._id.toString())) {
            managersMap.set(p.owner_id._id.toString(), {
                id: p.owner_id._id,
                name: p.owner_id.name,
                avatar_url: p.owner_id.avatar_url
            });
        }
    });

    // 3. Categories
    const categories = await ProjectCategory.find({ team_id: { $in: teams.map(t => t._id) } }).select('name color_code').lean();

    // 4. Project Statuses (Hardcoded based on model enum)
    const statuses = [
        { id: 'proposed', name: 'Proposed', color_code: '#d9d9d9' },
        { id: 'in_planning', name: 'In Planning', color_code: '#faad14' },
        { id: 'in_progress', name: 'In Progress', color_code: '#1890ff' },
        { id: 'on_hold', name: 'On Hold', color_code: '#faad14' },
        { id: 'blocked', name: 'Blocked', color_code: '#ff4d4f' },
        { id: 'active', name: 'Active', color_code: '#52c41a' },
        { id: 'completed', name: 'Completed', color_code: '#1890ff' },
        { id: 'cancelled', name: 'Cancelled', color_code: '#ff4d4f' },
        { id: 'continuous', name: 'Continuous', color_code: '#52c41a' }
    ];

    // 5. Healths
    const healths = [
      { id: 'not_set', name: 'Not Set', color_code: '#d9d9d9' },
      { id: 'good', name: 'Good', color_code: '#52c41a' },
      { id: 'needs_attention', name: 'Needs Attention', color_code: '#faad14' },
      { id: 'at_risk', name: 'At Risk', color_code: '#faad14' },
      { id: 'critical', name: 'Critical', color_code: '#ff4d4f' }
    ];

    res.json({
        done: true,
        body: {
            teams: teams.map(t => ({ id: t._id, name: t.name, color: t.color_code })),
            managers: Array.from(managersMap.values()),
            categories: categories.map(c => ({ id: c._id, name: c.name, color: c.color_code })),
            statuses,
            healths
        }
    });

  } catch (error) {
    next(error);
  }
};

const { Project, Task, TaskStatus, TimeLog, ActivityLog, ProjectComment, ProjectCategory, ProjectMember, Team, TeamMember } = require('../models');
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
    // Return basic info - organization name can be added later if needed
    res.json({
      done: true,
      body: {
        organization_name: ''
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

    // 2. Projects Stats (where user is a member)
    const myProjectMemberships = await ProjectMember.find({ user_id: userId, is_active: true }).select('project_id');
    const projectIds = myProjectMemberships.map(m => m.project_id);

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

    // Get user's projects
    const memberships = await ProjectMember.find({ user_id: userId, is_active: true });
    const projectIds = memberships.map(m => m.project_id);

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

    const total = await Project.countDocuments(query);

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
    
    // ALWAYS filter by user's project memberships first
    const userId = req.user._id;
    const memberships = await ProjectMember.find({ user_id: userId, is_active: true });
    const allowedProjectIds = memberships.map(m => m.project_id);
    logger.debug(`User ${userId} has ${memberships.length} project memberships`);
    
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
// Helper functions (existing)
async function getStatusIdsByCategory(projectId, category) {
   // This would be expensive in loop. Better to fetch all statuses once or use aggregation.
   // For now, simple return [] to avoid crash, or fetch all TaskStatus with category.
   const statuses = await TaskStatus.find({ project_id: projectId, category: category }).select('_id');
   return statuses.map(s => s._id);
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
    return hours ? `${hours}h` : '0h';
}

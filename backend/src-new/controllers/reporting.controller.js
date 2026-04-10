const { Project, Task, TaskStatus, TimeLog, ActivityLog, ProjectComment, ProjectCategory, ProjectMember, Team, TeamMember } = require('../models');
const mongoose = require('mongoose');

/**
 * @desc    Get reporting overview statistics
 * @route   GET /api/reporting/overview/statistics
 * @access  Private
 */
exports.getOverviewStatistics = async (req, res, next) => {
    res.json({ done: true, body: {} });
};

/**
 * @desc    Get reporting overview teams
 * @route   GET /api/reporting/overview/teams
 * @access  Private
 */
exports.getOverviewTeams = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find teams where user is a member
    const teamMemberships = await TeamMember.find({ user_id: userId, is_active: true })
        .populate('team_id', 'name color_code');
    
    const teams = await Promise.all(teamMemberships.map(async (tm) => {
        if (!tm.team_id) return null;
        
        const teamId = tm.team_id._id;
        
        // Count projects in this team
        const projectCount = await Project.countDocuments({ team_id: teamId, is_archived: false });
        
        // Fetch members for Avatars
        const teamMembers = await TeamMember.find({ team_id: teamId, is_active: true })
            .populate('user_id', 'name avatar_url email')
            .limit(5); // Limit to 5 for previews

        const members = teamMembers.map(m => ({
            id: m.user_id._id,
            name: m.user_id.name,
            avatar_url: m.user_id.avatar_url,
            email: m.user_id.email
        }));

        return {
            id: teamId,
            name: tm.team_id.name,
            color_code: tm.team_id.color_code,
            projects_count: projectCount,
            members: members
        };
    }));

    res.json({
      done: true,
      body: teams.filter(Boolean)
    });

  } catch (error) {
    next(error);
  }
};

exports.getProjectsReports = async (req, res, next) => {
  try {
    console.log('Reporting Projects Body:', req.body);
    const { index, size, field, order, search, archived, statuses, healths, categories, project_managers } = req.body;
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

    // Map status strings to display objects
    const getStatusInfo = (statusStr) => {
        switch(statusStr) {
            case 'active': return { name: 'Active', color_code: '#52c41a', icon: 'play-circle' };
            case 'on_hold': return { name: 'On Hold', color_code: '#faad14', icon: 'pause-circle' };
            case 'completed': return { name: 'Completed', color_code: '#1890ff', icon: 'check-circle' };
            case 'cancelled': return { name: 'Cancelled', color_code: '#ff4d4f', icon: 'stop' };
            default: return { name: statusStr || 'Unknown', color_code: '#d9d9d9', icon: 'question-circle' };
        }
    };

    // Helper for formatting time ago
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

    // Enrich data
    const enrichedProjects = await Promise.all(projects.map(async (p) => {
        // 1. Task Stats & Hours (Aggregation)

        // Fetch valid status IDs for this project mapped by category
        const statusMap = { todo: [], doing: [], done: [] };
        const statuses = await TaskStatus.find({ project_id: p._id });
        statuses.forEach(s => {
            if (statusMap[s.category]) statusMap[s.category].push(s._id);
        });

        // Aggregate Tasks
        const taskAgg = await Task.aggregate([
            { $match: { project_id: p._id, is_archived: false } },
            { $group: {
                _id: null,
                total: { $sum: 1 },
                estHours: { $sum: "$estimated_hours" },
                actHours: { $sum: "$actual_hours" },
                todoCount: { 
                    $sum: { $cond: [{ $in: ["$status_id", statusMap.todo] }, 1, 0] } 
                },
                doingCount: { 
                    $sum: { $cond: [{ $in: ["$status_id", statusMap.doing] }, 1, 0] } 
                },
                doneCount: { 
                    $sum: { $cond: [{ $in: ["$status_id", statusMap.done] }, 1, 0] } 
                }
            }}
        ]);

        const stats = taskAgg[0] || { total: 0, estHours: 0, actHours: 0, todoCount: 0, doingCount: 0, doneCount: 0 };
        
        const estimatedHours = p.estimated_hours || stats.estHours || 0;
        const actualHours = p.actual_hours || stats.actHours || 0;

        const now = new Date();
        const end = p.end_date ? new Date(p.end_date) : null;
        let daysLeft = null;
        let isOverdue = false;
        let isToday = false;

        if (end) {
            const diffTime = end.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays < 0) isOverdue = true;
            else if (diffDays === 0) isToday = true;
            else daysLeft = diffDays;
        }
        
        const statusInfo = getStatusInfo(p.status);

        const lastLog = await ActivityLog.findOne({ project_id: p._id }).sort({ created_at: -1 });
        const lastActivityString = lastLog ? timeAgo(lastLog.created_at) : 'No activity';

        const lastComment = await ProjectComment.findOne({ project_id: p._id }).sort({ created_at: -1 });
        const projectUpdate = lastComment ? lastComment.content : '';

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
                todo: stats.todoCount,
                doing: stats.doingCount,
                done: stats.doneCount
            },
            estimated_time: estimatedHours,
            actual_time: actualHours,
            estimated_time_string: formatHours(estimatedHours),
            actual_time_string: formatHours(actualHours),
            project_manager: {
                name: p.owner_id?.name,
                avatar_url: p.owner_id?.avatar_url
            },
            client: p.client_id ? 'Client Name' : '', 
            last_activity: { last_activity_string: lastActivityString },
            comment: projectUpdate
        };
    }));

    res.json({
        done: true,
        body: {
            total,
            projects: enrichedProjects
        }
    });

  } catch (error) {
    console.error('getProjectsReports Error:', error);
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

    console.log('User:', req.user._id, req.user.name);
    console.log('Body:', JSON.stringify(req.body));


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
    console.log(`User ${userId} has ${memberships.length} project memberships`);
    console.log('Allowed project IDs:', allowedProjectIds.map(id => id.toString()));
    
    // Then apply team filter if needed (but stay within user's allowed projects)
    if (Array.isArray(teams) && teams.length > 0) {
        console.log('Teams filter requested:', teams);
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
        .populate('status_id', 'icon color_code') 
        .select('name color_code status team_id')
        .lean();
    
    console.log(`Found ${projects.length} matching projects.`);
    if (projects.length > 0) {
        console.log('Sample project:', projects[0].name);
    }

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

    console.log(`\n=== ALLOCATION RESPONSE ===`);
    console.log(`Projects count: ${projectsResponse.length}`);
    console.log(`Users count: ${finalUsers.length}`);
    if (projectsResponse.length > 0) {
        console.log(`Sample project: ${projectsResponse[0].name} with ${projectsResponse[0].time_logs.length} user logs`);
    }
    console.log(`===========================\n`);

    res.json({
        done: true,
        body: {
            projects: projectsResponse,
            users: finalUsers
        }
    });

  } catch (error) {
     console.error('getAllocationData Error:', error);
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

    console.log('Reporting Users Body:', req.body);

    const page = parseInt(index) || 1;
    const limit = parseInt(size) || 10;
    const skip = (page - 1) * limit;

    // Get members in user's team(s)
    // First find user's active team
    const myMembership = await TeamMember.findOne({ user_id: userId, is_active: true });
    if (!myMembership) {
        return res.json({ done: true, body: { total: 0, members: [] } });
    }
    const teamId = myMembership.team_id;
    console.log('Member Team ID:', teamId);

    // Build query for members
    const memberQuery = { team_id: teamId, is_active: true };
    // If search text provided, we need to filter by User name.
    
    let memberIds = [];
    if (search) {
        const users = await mongoose.model('User').find({ name: { $regex: search, $options: 'i' } }).select('_id');
        const uIds = users.map(u => u._id);
        memberQuery.user_id = { $in: uIds };
    }

    const total = await TeamMember.countDocuments(memberQuery);
    
    const members = await TeamMember.find(memberQuery)
        .populate('user_id', 'name avatar_url email')
        .skip(skip)
        .limit(limit)
        .lean();
    
    console.log(`Found ${members.length} members.`);

    // Enrich Members with Task Stats
    const enrichedMembers = await Promise.all(members.map(async (m) => {
        if (!m.user_id) return null; // Should not happen

        const mUserId = m.user_id._id;
        
        // Build Task Query
        const taskQuery = { 
            assignees: mUserId, 
            is_archived: false 
        };
        
        // Date Range Filter
        if (date_range && Array.isArray(date_range) && date_range.length === 2) {
             taskQuery.due_date = { 
                 $gte: new Date(date_range[0]), 
                 $lte: new Date(date_range[1]) 
             };
        } else if (duration) {
            // Handle duration string (e.g. 'last-30-days') if needed, implies backend calculation
            // For now assuming date_range is primary filter if provided.
        }

        const tasks = await Task.find(taskQuery).select('status_id due_date project_id');
        console.log(`Member ${m.user_id.name} (${mUserId}): Found ${tasks.length} tasks.`);
        
        // Get status categories
        // We need status category for each task.
        // Optimization: Get all status IDs for these tasks and map them.
        const statusIds = tasks.map(t => t.status_id).filter(Boolean);
        const statuses = await TaskStatus.find({ _id: { $in: statusIds } });
        const statusMap = {}; // ID -> category
        statuses.forEach(s => statusMap[s._id.toString()] = s.category);

        let todo = 0, doing = 0, done = 0, overdue = 0;
        const now = new Date();

        tasks.forEach(task => {
            const cat = statusMap[task.status_id?.toString()] || 'todo';
            if (cat === 'done') done++;
            else if (cat === 'doing') doing++;
            else todo++;

            // Overdue check
            if (task.due_date && new Date(task.due_date) < now && cat !== 'done') {
                overdue++;
            }
        });

        const totalTasks = tasks.length;
        const ongoing = todo + doing;

        return {
            id: mUserId, 
            name: m.user_id.name,
            email: m.user_id.email,
            avatar_url: m.user_id.avatar_url,
            // Stats
            tasks: totalTasks, 
            completed: done,
            ongoing: ongoing,
            overdue: overdue,
            tasks_stat: {
                todo,
                doing,
                done
            }
        };
    }));

    res.json({
        done: true,
        body: {
            total,
            members: enrichedMembers.filter(Boolean)
        }
    });

  } catch (error) {
    console.error('getMembersReports Error:', error);
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
    console.log(`Found ${projects.length} projects`);
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

    console.log(`\n=== PROJECTS TIME REPORT RESPONSE ===`);
    console.log(`Projects with time logs: ${result.length}`);
    console.log(`=====================================\n`);

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
    console.log(`Found ${projects.length} projects`);
    
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

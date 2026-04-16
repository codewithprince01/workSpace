const express = require('express');
const router = express.Router();
const { Project, Task, TaskStatus, TeamMember, ProjectMember, TimeLog } = require('../models');
const ExcelJS = require('exceljs');
const moment = require('moment');
const { protect } = require('../middlewares/auth.middleware');

/**
 * @desc    Export members reporting data to Excel
 * @route   GET /api/reporting-export/members/export
 * @access  Private
 */
router.get('/members/export', protect, async (req, res) => {
  try {
    const { team_name, duration, date_range, archived } = req.query;
    const userId = req.user._id;

    console.log('Exporting members report for user:', userId, 'Query:', req.query);

    // 1. Get user's teams
    const myMemberships = await TeamMember.find({ user_id: userId, is_active: true }).select('team_id');
    const teamIds = myMemberships.map(m => m.team_id).filter(Boolean);

    if (teamIds.length === 0) {
      return res.status(404).json({ done: false, message: 'No teams found' });
    }

    // 2. Get projects and members
    const archivedFilter = archived === 'true';
    const projects = await Project.find({ 
      team_id: { $in: teamIds }, 
      is_archived: archivedFilter ? undefined : false 
    }).select('_id');
    const projectIds = projects.map(p => p._id);

    const projectMembers = await ProjectMember.find({
      project_id: { $in: projectIds },
      is_active: true,
    }).populate('user_id', 'name email').lean();

    const uniqueUsersMap = {};
    projectMembers.forEach(pm => {
      if (pm.user_id) {
        uniqueUsersMap[pm.user_id._id.toString()] = pm.user_id;
      }
    });
    const users = Object.values(uniqueUsersMap);

    // 3. Get task stats
    const taskQuery = { assignees: { $in: users.map(u => u._id) }, is_archived: false };
    
    // Parse date_range - can be array or string
    let startDate, endDate;
    if (date_range) {
      const dates = Array.isArray(date_range) ? date_range : date_range.split(',');
      if (dates.length === 2) {
        startDate = new Date(dates[0]);
        endDate = new Date(dates[1]);
        if (!isNaN(startDate) && !isNaN(endDate)) {
          taskQuery.due_date = { $gte: startDate, $lte: endDate };
        }
      }
    }

    const tasks = await Task.find(taskQuery).select('assignees status_id due_date project_id').lean();
    const statusIds = [...new Set(tasks.map(t => t.status_id?.toString()).filter(Boolean))];
    const statuses = await TaskStatus.find({ _id: { $in: statusIds } }).select('category').lean();
    const statusMap = {};
    statuses.forEach(s => { statusMap[s._id.toString()] = s.category; });

    const memberStatsMap = {};
    const now = new Date();
    tasks.forEach(task => {
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

    // 4. Get time logs for total time
    const timeLogQuery = { user_id: { $in: users.map(u => u._id) } };
    if (startDate && endDate) {
      timeLogQuery.created_at = { $gte: startDate, $lte: endDate };
    }
    
    const timeLogs = await TimeLog.find(timeLogQuery).select('user_id hours').lean();
    const timeStatsMap = {};
    timeLogs.forEach(log => {
      const uidStr = log.user_id.toString();
      if (!timeStatsMap[uidStr]) {
        timeStatsMap[uidStr] = { totalSeconds: 0 };
      }
      // Convert hours to seconds
      timeStatsMap[uidStr].totalSeconds += (log.hours || 0) * 3600;
    });

    // 5. Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Members Report');

    worksheet.columns = [
      { header: 'Member', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Tasks Assigned', key: 'tasks', width: 15 },
      { header: 'Overdue Tasks', key: 'overdue', width: 15 },
      { header: 'Completed Tasks', key: 'completed', width: 15 },
      { header: 'Ongoing Tasks', key: 'ongoing', width: 15 },
      { header: 'Total Time (seconds)', key: 'totalTime', width: 20 },
      { header: 'Done Tasks(%)', key: 'donePercent', width: 15 },
      { header: 'Doing Tasks(%)', key: 'doingPercent', width: 15 },
      { header: 'Todo Tasks(%)', key: 'todoPercent', width: 15 },
    ];

    users.forEach(u => {
      const uid = u._id.toString();
      const stats = memberStatsMap[uid] || { todo: 0, doing: 0, done: 0, overdue: 0, total: 0, projects: new Set() };
      const timeStats = timeStatsMap[uid] || { totalSeconds: 0 };
      
      const donePercent = stats.total > 0 ? ((stats.done / stats.total) * 100).toFixed(0) : 0;
      const doingPercent = stats.total > 0 ? ((stats.doing / stats.total) * 100).toFixed(0) : 0;
      const todoPercent = stats.total > 0 ? ((stats.todo / stats.total) * 100).toFixed(0) : 0;
      
      worksheet.addRow({
        name: u.name,
        email: u.email,
        tasks: stats.total,
        overdue: stats.overdue,
        completed: stats.done,
        ongoing: stats.todo + stats.doing,
        totalTime: timeStats.totalSeconds,
        donePercent: donePercent,
        doingPercent: doingPercent,
        todoPercent: todoPercent,
      });
    });

    // Header styling
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F7FF' }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Members_Report_${moment().format('YYYY-MM-DD')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export Excel Error:', error);
    res.status(500).send('Internal Server Error while generating Excel');
  }
});

/**
 * @desc    Export projects reporting data to Excel
 * @route   GET /api/reporting-export/projects/export
 * @access  Private
 */
router.get('/projects/export', protect, async (req, res) => {
  try {
    const { team_name } = req.query;
    const userId = req.user._id;

    const myMemberships = await TeamMember.find({ user_id: userId, is_active: true }).select('team_id');
    const teamIds = myMemberships.map(m => m.team_id).filter(Boolean);

    const projects = await Project.find({ team_id: { $in: teamIds } })
        .populate('team_id', 'name')
        .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Projects Report');

    worksheet.columns = [
      { header: 'Project', key: 'name', width: 30 },
      { header: 'Team', key: 'team', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Health', key: 'health', width: 15 },
      { header: 'Start Date', key: 'start', width: 15 },
      { header: 'End Date', key: 'end', width: 15 },
    ];

    projects.forEach(p => {
      worksheet.addRow({
        name: p.name,
        team: p.team_id?.name || team_name || '-',
        status: p.status_id || '-',
        health: p.project_health || '-',
        start: p.start_date ? moment(p.start_date).format('YYYY-MM-DD') : '-',
        end: p.end_date ? moment(p.end_date).format('YYYY-MM-DD') : '-',
      });
    });

    worksheet.getRow(1).font = { bold: true };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Projects_Report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * @desc    Export project members to Excel
 * @route   GET /api/reporting-export/project-members/export
 * @access  Private
 */
router.get('/project-members/export', protect, async (req, res) => {
    try {
        const { project_id, project_name } = req.query;
        
        const members = await ProjectMember.find({ project_id })
            .populate('user_id', 'name email')
            .lean();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Project Members');

        worksheet.columns = [
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Email', key: 'email', width: 35 },
            { header: 'Role', key: 'role', width: 20 },
        ];

        members.forEach(m => {
            worksheet.addRow({
                name: m.user_id?.name || '-',
                email: m.user_id?.email || '-',
                role: m.role || '-',
            });
        });

        worksheet.getRow(1).font = { bold: true };
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Project_Members_${project_name}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

/**
 * @desc    Export project tasks to Excel
 * @route   GET /api/reporting-export/project-tasks/export
 * @access  Private
 */
router.get('/project-tasks/export', protect, async (req, res) => {
    try {
        const { project_id, project_name } = req.query;
        
        const tasks = await Task.find({ project_id, is_archived: false })
            .populate('status_id', 'name')
            .lean();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Project Tasks');

        worksheet.columns = [
            { header: 'Task', key: 'name', width: 40 },
            { header: 'Status', key: 'status', width: 20 },
            { header: 'Priority', key: 'priority', width: 15 },
            { header: 'Due Date', key: 'due', width: 15 },
        ];

        tasks.forEach(t => {
            worksheet.addRow({
                name: t.name,
                status: t.status_id?.name || '-',
                priority: t.priority || '-',
                due: t.due_date ? moment(t.due_date).format('YYYY-MM-DD') : '-',
            });
        });

        worksheet.getRow(1).font = { bold: true };
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Project_Tasks_${project_name}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;

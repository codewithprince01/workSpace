const { Task, TaskStatus, ActivityLog, ProjectMember, TimeLog, Project } = require('../models');

exports.getProjectInsights = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Basic insights: progress, status counts
    const totalTasks = await Task.countDocuments({ project_id: id, is_archived: false });
    const statuses = await TaskStatus.find({ project_id: id });
    
    const statusCounts = await Promise.all(statuses.map(async (s) => {
        const count = await Task.countDocuments({ project_id: id, status_id: s._id, is_archived: false });
        return { name: s.name, count, color: s.color_code };
    }));

    res.json({
        done: true,
        body: {
            total_tasks: totalTasks,
            status_counts: statusCounts
        }
    });
  } catch (error) {
    next(error);
  }
};

exports.getProjectOverviewData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';


    const query = { project_id: id };
    if (!includeArchived) {
      query.is_archived = false;
    }


    // Get done statuses
    const doneStatuses = await TaskStatus.find({ project_id: id, category: 'done' }).select('_id');
    const doneStatusIds = doneStatuses.map(s => s._id);

    // Get todo statuses
    const todoStatuses = await TaskStatus.find({ project_id: id, category: 'todo' }).select('_id');
    const todoStatusIds = todoStatuses.map(s => s._id);

    // Count tasks
    const totalTasks = await Task.countDocuments(query);

    const completedTasks = await Task.countDocuments({ 
        ...query, 
        status_id: { $in: doneStatusIds } 
    });

    const todoTasks = await Task.countDocuments({ 
        ...query, 
        status_id: { $in: todoStatusIds } 
    });

    // Count overdue tasks (not done and past due date)
    // Check both end_date and due_date
    const overdueQuery = {
      ...query,
      status_id: { $nin: doneStatusIds },
      $or: [
        { end_date: { $lt: new Date(), $ne: null } },
        { due_date: { $lt: new Date(), $ne: null } }
      ]
    };
    
    const overdueTasks = await Task.countDocuments(overdueQuery);

    // Calculate overdue hours (sum of estimates)
    const overdueTaskDocs = await Task.find(overdueQuery).select('estimated_hours');
    const overdueHours = overdueTaskDocs.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);

    // Calculate total estimated hours
    const tasksWithEstimates = await Task.find(query).select('estimated_hours');
    const totalEstimatedHours = tasksWithEstimates.reduce((sum, task) => sum + (task.estimated_hours || 0), 0);

    // Calculate total logged hours
    let totalLoggedHours = 0;
    try {
      // Get all task IDs for this project first
      const allProjectTasks = await Task.find({ project_id: id }).select('_id');
      const allTaskIds = allProjectTasks.map(t => t._id);
      
      const logStats = await TimeLog.aggregate([
        { $match: { task_id: { $in: allTaskIds } } },
        { $group: { _id: null, total: { $sum: '$hours' } } }
      ]);
      
      totalLoggedHours = logStats.length > 0 ? logStats[0].total : 0;
    } catch (err) {
      console.error('Error calculating logs:', err);
      totalLoggedHours = 0;
    }

    // Format hours as string (e.g., "24h" or "2d 4h")
    const formatHours = (hours) => {
      if (!hours || hours === 0) return '0h';
      
      // If less than 1 hour, show minutes
      if (hours < 1) {
          const mins = Math.round(hours * 60);
          return `${mins}m`;
      }
      
      return `${parseFloat(hours.toFixed(1))}h`;
    };

    const responseBody = {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      completed_tasks_count: completedTasks,
      todo_tasks_count: todoTasks,
      overdue_count: overdueTasks,
      overdue_hours: overdueHours,
      overdue_hours_string: formatHours(overdueHours),
      progress: totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0,
      total_estimated_hours: totalEstimatedHours,
      total_estimated_hours_string: formatHours(totalEstimatedHours),
      total_logged_hours: totalLoggedHours,
      total_logged_hours_string: formatHours(totalLoggedHours)
    };


    res.json({
      done: true,
      body: responseBody
    });
  } catch (error) {
    console.error('Error in getProjectOverviewData:', error);
    next(error);
  }
};

exports.getLastUpdatedTasks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';

    const query = { project_id: id };
    if (!includeArchived) {
      query.is_archived = false;
    }

    const tasks = await Task.find(query)
        .sort({ updated_at: -1 })
        .limit(10)
        .populate('status_id', 'name color_code');
    
    const formattedTasks = tasks.map(task => ({
      id: task._id,
      name: task.name,
      status: task.status_id?.name || 'No Status',
      status_color: task.status_id?.color_code || '#cccccc',
      end_date: task.end_date || task.due_date,
      updated_at: task.updated_at
    }));

    res.json({ done: true, body: formattedTasks });
  } catch (error) {
    next(error);
  }
};

exports.getProjectLogs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const logs = await ActivityLog.find({ project_id: id })
        .sort({ created_at: -1 })
        .limit(50)
        .populate('done_by', 'name avatar_url');
    res.json({ done: true, body: logs });
  } catch (error) {
    next(error);
  }
};

exports.getTaskStatusCounts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';


    const statuses = await TaskStatus.find({ project_id: id });

    const query = { project_id: id };
    if (!includeArchived) {
      query.is_archived = false;
    }

    const counts = await Promise.all(statuses.map(async (s) => {
        const count = await Task.countDocuments({ ...query, status_id: s._id });
        console.log(`Status "${s.name}": ${count} tasks`);
        return { name: s.name, y: count, color: s.color_code };
    }));


    res.json({ done: true, body: counts });
  } catch (error) {
    console.error('Error in getTaskStatusCounts:', error);
    next(error);
  }
};

exports.getPriorityOverview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';


    const query = { project_id: id };
    if (!includeArchived) {
      query.is_archived = false;
    }

    const priorityColors = {
      urgent: '#f37070',
      high: '#fbc84c',
      medium: '#75c997',
      low: '#70a6f3'
    };

    const priorities = ['urgent', 'high', 'medium', 'low'];
    const counts = await Promise.all(priorities.map(async (p) => {
        const count = await Task.countDocuments({ ...query, priority: p });
        console.log(`Priority "${p}": ${count} tasks`);
        return { 
          name: p.charAt(0).toUpperCase() + p.slice(1), 
          data: [count],
          color: priorityColors[p]
        };
    }));


    res.json({ done: true, body: counts });
  } catch (error) {
    console.error('Error in getPriorityOverview:', error);
    next(error);
  }
};

exports.getOverdueTasks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';

    // Get done status IDs to exclude
    const doneStatuses = await TaskStatus.find({ project_id: id, category: 'done' }).select('_id');
    const doneStatusIds = doneStatuses.map(s => s._id);

    const tasks = await Task.find({ 
        project_id: id, 
        is_archived: includeArchived ? { $in: [true, false] } : false, 
        $or: [
          { end_date: { $lt: new Date(), $ne: null } },
          { due_date: { $lt: new Date(), $ne: null } }
        ],
        status_id: { $nin: doneStatusIds }
    }).populate('status_id', 'name color_code').lean();

    const formattedTasks = tasks.map(task => {
      const now = new Date();
      // Prefer end_date as deadline
      const deadline = new Date(task.end_date || task.due_date);
      const diffTime = now - deadline; // Positive if overdue
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        taskId: task._id,
        name: task.name,
        status_name: task.status_id?.name || '',
        status_color: task.status_id?.color_code || '#cccccc',
        end_date: task.end_date || task.due_date,
        days_overdue: Math.max(0, diffDays)
      };
    });

    res.json({ done: true, body: formattedTasks });
  } catch (error) {
    next(error);
  }
};

exports.getTasksCompletedEarly = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';

    // Get done status IDs
    const doneStatuses = await TaskStatus.find({ project_id: id, category: 'done' }).select('_id');
    const doneStatusIds = doneStatuses.map(s => s._id);

    // Tasks completed before due date
    const tasks = await Task.find({ 
        project_id: id, 
        is_archived: includeArchived ? { $in: [true, false] } : false, 
        status_id: { $in: doneStatusIds },
        due_date: { $ne: null },
        completed_at: { $ne: null }
    }).populate('status_id', 'name color_code').lean();

    // Filter tasks where completed_at < due_date
    const earlyTasks = tasks.filter(task => {
      if (!task.completed_at || !task.due_date) return false;
      return new Date(task.completed_at) < new Date(task.due_date);
    });

    const formattedTasks = earlyTasks.map(task => ({
      taskId: task._id,
      name: task.name,
      status_name: task.status_id?.name || '',
      status_color: task.status_id?.color_code || '#cccccc',
      end_date: task.due_date,
      completed_at: task.completed_at
    }));

    res.json({ done: true, body: formattedTasks });
  } catch (error) {
    next(error);
  }
};

exports.getTasksCompletedLate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';

    // Get done status IDs
    const doneStatuses = await TaskStatus.find({ project_id: id, category: 'done' }).select('_id');
    const doneStatusIds = doneStatuses.map(s => s._id);

    // Tasks completed after due date
    const tasks = await Task.find({ 
        project_id: id, 
        is_archived: includeArchived ? { $in: [true, false] } : false, 
        status_id: { $in: doneStatusIds },
        due_date: { $ne: null },
        completed_at: { $ne: null }
    }).populate('status_id', 'name color_code').lean();

    // Filter tasks where completed_at > due_date
    const lateTasks = tasks.filter(task => {
      if (!task.completed_at || !task.due_date) return false;
      return new Date(task.completed_at) > new Date(task.due_date);
    });

    const formattedTasks = lateTasks.map(task => ({
      taskId: task._id,
      name: task.name,
      status_name: task.status_id?.name || '',
      status_color: task.status_id?.color_code || '#cccccc',
      end_date: task.due_date,
      completed_at: task.completed_at
    }));

    res.json({ done: true, body: formattedTasks });
  } catch (error) {
    next(error);
  }
};

exports.getMemberInsightAStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';

    // Get all project members
    const members = await ProjectMember.find({ project_id: id, is_active: true }).populate('user_id', 'name avatar_url');
    const totalMembersCount = members.length;

    // Get done status IDs
    const doneStatuses = await TaskStatus.find({ project_id: id, category: 'done' }).select('_id');
    const doneStatusIds = doneStatuses.map(s => s._id);

    // Count members with overdue tasks
    let overdueMembers = 0;
    let unassignedMembers = 0;

    for (const m of members) {
      if (!m.user_id) continue;

      // Check if member has any overdue tasks
      const overdueCount = await Task.countDocuments({
        project_id: id,
        assignees: m.user_id._id,
        is_archived: includeArchived ? { $in: [true, false] } : false,
        due_date: { $lt: new Date() },
        status_id: { $nin: doneStatusIds }
      });
      if (overdueCount > 0) overdueMembers++;

      // Check if member has any tasks assigned
      const assignedCount = await Task.countDocuments({
        project_id: id,
        assignees: m.user_id._id,
        is_archived: includeArchived ? { $in: [true, false] } : false
      });
      if (assignedCount === 0) unassignedMembers++;
    }

    res.json({
      done: true,
      body: {
        total_members_count: totalMembersCount,
        overdue_members: overdueMembers,
        unassigned_members: unassignedMembers
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getMemberTasks = async (req, res, next) => {
    res.json({ done: true, body: [] });
};

exports.getProjectDeadlineStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';

    const project = await Project.findById(id);
    const query = { project_id: id };
    if (!includeArchived) {
      query.is_archived = { $ne: true };
    }

    // Get done statuses
    const doneStatuses = await TaskStatus.find({ project_id: id, category: 'done' }).select('_id');
    const doneStatusIds = doneStatuses.map(s => s._id);

    // Find overdue tasks
    const overdueTasks = await Task.find({
      ...query,
      $or: [
        { end_date: { $lt: new Date(), $ne: null } },
        { due_date: { $lt: new Date(), $ne: null } }
      ],
      status_id: { $nin: doneStatusIds }
    })
    .populate('status_id', 'name color_code')
    .sort({ due_date: 1 })
    .limit(20);

    // Calculate total overdue hours (logged via aggregation for accuracy)
    const overdueTaskIds = overdueTasks.map(t => t._id);
    const logStats = await TimeLog.aggregate([
       { $match: { task_id: { $in: overdueTaskIds } } },
       { $group: { _id: null, total: { $sum: '$hours' } } }
    ]);
    const totalOverdueHours = logStats.length > 0 ? logStats[0].total : 0;

    // Format hours
    const formatHours = (hours) => {
      if (!hours || hours === 0) return '0h';
      if (hours < 1) {
          const mins = Math.round(hours * 60);
          return `${mins}m`;
      }
      return `${parseFloat(hours.toFixed(1))}h`;
    };
    
    // Format Date
    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString(); 
    };

    res.json({ 
      done: true, 
      body: { 
        deadline_tasks_count: overdueTasks.length,
        deadline_logged_hours_string: formatHours(totalOverdueHours),
        project_end_date: formatDate(project?.end_date),
        tasks: overdueTasks.map(task => ({
          taskId: task._id,
          name: task.name,
          status: task.status_id?.name || 'No Status',
          status_color: task.status_id?.color_code || '#cccccc',
          end_date: task.end_date || task.due_date
        }))
      } 
    });
  } catch (error) {
    next(error);
  }
};

exports.getOverloggedTasks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.query;
    const includeArchived = archived === 'true';


    // Get all tasks with estimated hours
    const tasks = await Task.find({ 
        project_id: id, 
        is_archived: includeArchived ? { $in: [true, false] } : false,
        estimated_hours: { $gt: 0 }
    }).populate('status_id', 'name color_code')
      .populate('assignees', 'name avatar_url')
      .lean();

    // Get time logs for all tasks
    const taskIds = tasks.map(t => t._id);
    const timeLogs = await TimeLog.aggregate([
      { $match: { task_id: { $in: taskIds } } },
      { $group: { _id: '$task_id', totalHours: { $sum: '$hours' } } }
    ]);
    const timeLogMap = {};
    timeLogs.forEach(tl => {
      timeLogMap[tl._id.toString()] = tl.totalHours;
    });

    // Filter tasks where logged > estimated
    const overloggedTasks = tasks.filter(task => {
      const logged = timeLogMap[task._id.toString()] || 0;
      return logged > task.estimated_hours;
    });

    // Format hours
    const formatHours = (hours) => {
      if (!hours || hours === 0) return '0h';
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      if (m > 0) return `${h}h ${m}m`;
      return `${h}h`;
    };

    const formattedTasks = overloggedTasks.map(task => {
      const logged = timeLogMap[task._id.toString()] || 0;
      const overloggedTime = logged - task.estimated_hours;
      
      return {
        taskId: task._id,
        name: task.name,
        status_name: task.status_id?.name || '',
        status_color: task.status_id?.color_code || '#cccccc',
        members: task.assignees?.map(a => ({ id: a._id, name: a.name, avatar_url: a.avatar_url })) || [],
        overlogged_time_string: formatHours(overloggedTime),
        estimated_hours: task.estimated_hours,
        logged_hours: logged
      };
    });

    res.json({ done: true, body: formattedTasks });
  } catch (error) {
    next(error);
  }
};

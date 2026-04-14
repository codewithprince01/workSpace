const { Task, TaskStatus, TaskComment, TaskAttachment, Project, ProjectMember, TeamMember, TaskPhase, TaskLabel, ActivityLog, TimeLog, RunningTimer } = require('../models');
const taskService = require('../services/task.service');
const logger = require('../utils/logger');

/**
 * @desc    Create task
 * @route   POST /api/tasks
 * @access  Private
 */
exports.create = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.body, req.user._id);
    
    // Populate for response
    const populatedTask = await Task.findById(task._id)
      .populate('status_id', 'name color_code')
      .populate('assignees', 'name email avatar_url')
      .populate('reporter_id', 'name email');
    
    res.status(201).json({
      done: true,
      body: populatedTask
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get tasks by project
 * @route   GET /api/tasks
 * @access  Private
 */
exports.getAll = async (req, res, next) => {
  try {
    const { project_id, status_id, priority, assignee, reporter, search, parent_task_id, archived } = req.query;
    
    const query = {
      is_archived: archived === 'true',
      is_trashed: { $ne: true },
    };
    
    if (project_id) query.project_id = project_id;
    if (status_id) {
        if (typeof status_id === 'string' && status_id.includes(' ')) {
            query.status_id = { $in: status_id.split(' ') };
        } else {
            query.status_id = status_id;
        }
    }
    if (priority) {
        if (typeof priority === 'string' && priority.trim()) {
            query.priority = { $in: priority.trim().split(/\s+/) };
        } else if (Array.isArray(priority)) {
            query.priority = { $in: priority };
        } else {
            query.priority = priority;
        }
    }
    // Also handle 'priorities' plural for consistency with list/v3
    const prioritiesParam = req.query.priorities || req.query.priority;
    if (prioritiesParam && !query.priority) {
        if (typeof prioritiesParam === 'string' && prioritiesParam.trim()) {
            query.priority = { $in: prioritiesParam.trim().split(/\s+/) };
        } else if (Array.isArray(prioritiesParam)) {
            query.priority = { $in: prioritiesParam };
        }
    }

    if (assignee) {
        if (typeof assignee === 'string' && assignee.trim()) {
            query.assignees = { $in: assignee.trim().split(/\s+/) };
        } else if (Array.isArray(assignee)) {
            query.assignees = { $in: assignee };
        } else {
            query.assignees = assignee;
        }
    }
    // Also handle 'members' for consistency
    const membersParam = req.query.members || req.query.assignees;
    if (membersParam && !query.assignees) {
      if (typeof membersParam === 'string' && membersParam.trim()) {
          query.assignees = { $in: membersParam.trim().split(/\s+/) };
      } else if (Array.isArray(membersParam)) {
          query.assignees = { $in: membersParam };
      }
    }
    if (reporter) query.reporter_id = reporter;

    if (parent_task_id && parent_task_id !== 'undefined' && parent_task_id !== 'null' && parent_task_id !== '') {
      query.parent_task_id = parent_task_id;
    } else if (parent_task_id === 'null' || parent_task_id === '') {
      query.parent_task_id = null;
    } else {
      // Default: Only show top-level tasks (legacy-safe filter)
      query.$or = [
        { parent_task_id: null },
        { parent_task_id: { $exists: false } }
      ];
    }

    if (search && search.trim()) {
        query.name = { $regex: search.trim(), $options: 'i' };
    }
    
    let tasks = await Task.find(query)
      .populate('status_id', 'name color_code category')
      .populate('assignees', 'name email avatar_url')
      .populate('reporter_id', 'name email')
      .populate('labels', 'name color_code')
      .sort({ sort_order: 1, created_at: -1 });
    
    res.json({
      done: true,
      body: tasks,
      total: tasks.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single task
 * @route   GET /api/tasks/:id
 * @access  Private
 */
exports.getById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project_id', 'name key')
      .populate('status_id', 'name color_code')
      .populate('assignees', 'name email avatar_url')
      .populate('reporter_id', 'name email')
      .populate('labels', 'name color_code')
      .populate('phase_id', 'name color_code');
    
    if (!task) {
      return res.status(404).json({
        done: false,
        message: 'Task not found'
      });
    }
    
    // Get subtasks
    const subtasks = await Task.find({ parent_task_id: task._id, is_archived: false, is_trashed: { $ne: true } })
      .populate('status_id', 'name color_code')
      .populate('assignees', 'name email avatar_url');
    
    // Get comments
    const comments = await TaskComment.find({ task_id: task._id })
      .populate('user_id', 'name email avatar_url')
      .sort({ created_at: -1 });
    
    // Get attachments
    const attachments = await TaskAttachment.find({ task_id: task._id })
      .populate('user_id', 'name email');
    
    res.json({
      done: true,
      body: {
        ...task.toObject(),
        subtasks,
        comments,
        attachments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update task
 * @route   PUT /api/tasks/:id
 * @access  Private
 */
exports.update = async (req, res, next) => {
  try {
    const updates = req.body;
    
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        done: false,
        message: 'Task not found'
      });
    }
    
    // Update allowed fields
    const allowedFields = [
      'name', 'description', 'status_id', 'priority', 'assignees',
      'start_date', 'end_date', 'due_date', 'estimated_hours', 'actual_hours',
      'progress', 'sort_order', 'labels', 'phase_id'
    ];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'name') {
          task[field] = sanitizeText(updates[field]);
        } else if (field === 'description') {
          task[field] = sanitizeRich(updates[field]);
        } else {
          task[field] = updates[field];
        }
      }
    });
    
    // Check if task is completed
    if (updates.status_id) {
      const status = await TaskStatus.findById(updates.status_id);
      if (status && status.category === 'done') {
        const TaskDependency = require('../models/TaskDependency');
        const dependencies = await TaskDependency.find({ task_id: task._id }).populate({
          path: 'related_task_id',
          select: 'status_id',
          populate: { path: 'status_id', select: 'category' }
        });
        const hasIncompleteDependency = dependencies.some(dep => {
          const category = dep?.related_task_id?.status_id?.category;
          return category !== 'done';
        });
        if (hasIncompleteDependency) {
          return res.status(400).json({
            done: false,
            completed_deps: false,
            message: 'Please complete the task dependencies before proceeding',
          });
        }
      }
      if (status && status.category === 'done') {
        task.completed_at = new Date();
        task.progress = 100;
      } else if (status && status.category !== 'done') {
        task.completed_at = null;
      }
    }
    
    await task.save();
    
    const populatedTask = await Task.findById(task._id)
      .populate('status_id', 'name color_code')
      .populate('assignees', 'name email avatar_url');
    
    res.json({
      done: true,
      body: populatedTask
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete task
 * @route   DELETE /api/tasks/:id
 * @access  Private
 */
exports.delete = async (req, res, next) => {
  try {
    const task = await taskService.deleteTask(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        done: false,
        message: 'Task not found'
      });
    }
    
    res.json({
      done: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add comment to task
 * @route   POST /api/tasks/:id/comments
 * @access  Private
 */
exports.addComment = async (req, res, next) => {
  try {
    const { content, mentions } = req.body;
    
    const comment = await TaskComment.create({
      task_id: req.params.id,
      user_id: req.user._id,
      content: sanitizeRich(content),
      mentions
    });
    
    const populatedComment = await TaskComment.findById(comment._id)
      .populate('user_id', 'name email avatar_url');
    
    res.status(201).json({
      done: true,
      body: populatedComment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk update tasks (for drag & drop)
 * @route   PUT /api/tasks/bulk
 * @access  Private
 */
exports.bulkUpdate = async (req, res, next) => {
  try {
    const { tasks } = req.body; // Array of { id, updates } OR task ids
    const action = req.params.action;

    // Legacy drag/drop payload support: [{ id, ...updates }]
    if (
      !action &&
      Array.isArray(tasks) &&
      tasks.length > 0 &&
      typeof tasks[0] === 'object' &&
      tasks[0] !== null &&
      tasks[0].id
    ) {
      const results = await Promise.all(
        tasks.map(async ({ id, ...updates }) => Task.findByIdAndUpdate(id, updates, { new: true }))
      );

      return res.json({
        done: true,
        body: results
      });
    }

    const projectId = req.query.project || req.body.project_id;
    const taskIds = Array.isArray(tasks) ? tasks.filter(Boolean) : [];

    if (!action) {
      return res.status(400).json({
        done: false,
        message: 'Bulk action is required'
      });
    }

    if (!projectId || !taskIds.length) {
      return res.status(400).json({
        done: false,
        message: 'project and tasks are required'
      });
    }

    const taskFilter = { _id: { $in: taskIds }, project_id: projectId };

    if (action === 'status') {
      const { status_id: statusId } = req.body;
      if (!statusId) {
        return res.status(400).json({ done: false, message: 'status_id is required' });
      }

      const status = await TaskStatus.findById(statusId).select('category');
      if (status?.category === 'done') {
        const TaskDependency = require('../models/TaskDependency');
        const dependencies = await TaskDependency.find({ task_id: { $in: taskIds } }).populate({
          path: 'related_task_id',
          select: 'status_id',
          populate: { path: 'status_id', select: 'category' }
        });

        const blockedTaskIds = new Set();
        for (const dep of dependencies) {
          const depCategory = dep?.related_task_id?.status_id?.category;
          if (depCategory !== 'done') {
            blockedTaskIds.add(String(dep.task_id));
          }
        }

        const allowedTaskIds = taskIds.filter(id => !blockedTaskIds.has(String(id)));

        let result = { matchedCount: 0, modifiedCount: 0 };
        if (allowedTaskIds.length) {
          const update = { status_id: statusId, progress: 100, completed_at: new Date() };
          result = await Task.updateMany(
            { _id: { $in: allowedTaskIds }, project_id: projectId },
            { $set: update }
          );
        }

        return res.json({
          done: true,
          body: {
            matched: result.matchedCount || 0,
            modified: result.modifiedCount || 0,
            failed_tasks: Array.from(blockedTaskIds),
            completed_deps: blockedTaskIds.size === 0,
          }
        });
      }

      const update =
        status?.category === 'done'
          ? { status_id: statusId, progress: 100, completed_at: new Date() }
          : { status_id: statusId, completed_at: null };

      const result = await Task.updateMany(taskFilter, { $set: update });
      return res.json({
        done: true,
        body: { matched: result.matchedCount || 0, modified: result.modifiedCount || 0, failed_tasks: [] }
      });
    }

    if (action === 'priority') {
      const { priority_id: priority } = req.body;
      if (!priority) {
        return res.status(400).json({ done: false, message: 'priority_id is required' });
      }
      const result = await Task.updateMany(taskFilter, { $set: { priority } });
      return res.json({
        done: true,
        body: { matched: result.matchedCount || 0, modified: result.modifiedCount || 0 }
      });
    }

    if (action === 'phase') {
      const { phase_id: phaseId } = req.body;
      const result = await Task.updateMany(taskFilter, { $set: { phase_id: phaseId || null } });
      return res.json({
        done: true,
        body: { matched: result.matchedCount || 0, modified: result.modifiedCount || 0 }
      });
    }

    if (action === 'delete') {
      const result = await Task.updateMany(taskFilter, { $set: { is_trashed: true, is_archived: false } });
      await Task.updateMany(
        {
          project_id: projectId,
          parent_task_id: { $in: taskIds },
        },
        { $set: { is_trashed: true, is_archived: false } }
      );
      return res.json({
        done: true,
        body: { matched: result.matchedCount || 0, modified: result.modifiedCount || 0 }
      });
    }

    if (action === 'archive') {
      const shouldArchive = req.query.type !== 'unarchive';
      const result = await Task.updateMany(
        { ...taskFilter, is_trashed: { $ne: true } },
        { $set: { is_archived: shouldArchive } }
      );
      return res.json({
        done: true,
        body: { matched: result.matchedCount || 0, modified: result.modifiedCount || 0 }
      });
    }

    if (action === 'members') {
      const members = Array.isArray(req.body.members) ? req.body.members : [];

      const projectMemberIds = members.map(m => m?.project_member_id).filter(Boolean);
      const teamMemberIds = members.map(m => m?.team_member_id || m?.id).filter(Boolean);
      const directUserIds = members.map(m => m?.user_id).filter(Boolean);

      const [projectMembers, teamMembers] = await Promise.all([
        projectMemberIds.length
          ? ProjectMember.find({ _id: { $in: projectMemberIds } }).select('user_id')
          : Promise.resolve([]),
        teamMemberIds.length
          ? TeamMember.find({ _id: { $in: teamMemberIds } }).select('user_id')
          : Promise.resolve([])
      ]);

      const userIds = Array.from(
        new Set([
          ...directUserIds.map(String),
          ...projectMembers.map(pm => String(pm.user_id)),
          ...teamMembers.map(tm => String(tm.user_id))
        ])
      );

      if (!userIds.length) {
        return res.json({ done: true, body: { matched: 0, modified: 0 } });
      }

      const result = await Task.updateMany(taskFilter, {
        $addToSet: { assignees: { $each: userIds } }
      });

      return res.json({
        done: true,
        body: { matched: result.matchedCount || 0, modified: result.modifiedCount || 0 }
      });
    }

    if (action === 'assign-me') {
      const result = await Task.updateMany(taskFilter, {
        $addToSet: { assignees: String(req.user._id) }
      });

      return res.json({
        done: true,
        body: { matched: result.matchedCount || 0, modified: result.modifiedCount || 0 }
      });
    }

    if (action === 'label') {
      const incomingLabels = Array.isArray(req.body.labels) ? req.body.labels : [];
      const labelIds = incomingLabels.map(l => l?.id || l?._id).filter(Boolean);
      const text = (req.body.text || '').trim();

      if (text) {
        const project = await Project.findById(projectId).select('team_id');
        if (project?.team_id) {
          let label = await TaskLabel.findOne({ team_id: project.team_id, name: text });
          if (!label) {
            label = await TaskLabel.create({ team_id: project.team_id, name: text });
          }
          labelIds.push(String(label._id));
        }
      }

      const uniqueLabelIds = Array.from(new Set(labelIds.map(String)));
      if (!uniqueLabelIds.length) {
        return res.json({ done: true, body: { matched: 0, modified: 0 } });
      }

      const result = await Task.updateMany(taskFilter, {
        $addToSet: { labels: { $each: uniqueLabelIds } }
      });

      return res.json({
        done: true,
        body: { matched: result.matchedCount || 0, modified: result.modifiedCount || 0 }
      });
    }

    return res.status(400).json({
      done: false,
      message: `Unsupported bulk action: ${action}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update task group (status, priority, phase)
 * @route   PUT /api/tasks/:id/group
 * @access  Private
 */
exports.updateTaskGroup = async (req, res, next) => {
  try {
    const { group_type, group_value, project_id } = req.body;
    const taskId = req.params.id;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ done: false, message: 'Task not found' });

    let previousValue = null;
    let newValue = group_value;
    let attributeType = '';
    let logText = '';

    if (group_type === 'status') {
        previousValue = task.status_id;
        attributeType = 'STATUS';
        
        const status = await TaskStatus.findById(group_value);
        if (status) {
            if (status.category === 'done') {
                const TaskDependency = require('../models/TaskDependency');
                const dependencies = await TaskDependency.find({ task_id: taskId }).populate({
                  path: 'related_task_id',
                  select: 'status_id',
                  populate: { path: 'status_id', select: 'category' }
                });
                const hasIncompleteDependency = dependencies.some(dep => {
                  const category = dep?.related_task_id?.status_id?.category;
                  return category !== 'done';
                });
                if (hasIncompleteDependency) {
                  return res.status(400).json({
                    done: false,
                    completed_deps: false,
                    message: 'Please complete the task dependencies before proceeding',
                  });
                }
            }
            task.status_id = group_value;
            logText = `changed status to ${status.name}`;
            if (status.category === 'done') {
                task.completed_at = new Date();
                task.progress = 100;
            } else {
                task.completed_at = null;
            }
        }
    } else if (group_type === 'priority') {
        previousValue = task.priority;
        task.priority = group_value;
        attributeType = 'PRIORITY';
        logText = `changed priority to ${group_value}`;
    }

    await task.save();

    // Create Activity Log
    await ActivityLog.create({
        task_id: taskId,
        project_id: project_id || task.project_id,
        done_by: req.user._id,
        log_type: 'update',
        log_text: logText,
        attribute_type: attributeType,
        previous: previousValue,
        current: newValue
    });

    res.json({ done: true, body: task });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search tasks
 * @route   GET /api/tasks/search
 * @access  Private
 */
exports.search = async (req, res, next) => {
  try {
    const { searchQuery, project_id } = req.query;
    const query = { is_archived: false, is_trashed: { $ne: true } };
    if (project_id) query.project_id = project_id;
    if (searchQuery) query.name = { $regex: searchQuery, $options: 'i' };

    const tasks = await Task.find(query).limit(10).select('name');
    const results = tasks.map(t => ({ label: t.name, value: t._id }));
    
    res.json({ done: true, body: results });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get project progress status
 * @route   GET /api/tasks/progress-status/:projectId
 * @access  Private
 */
exports.getProgressStatus = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const totalTasks = await Task.countDocuments({ project_id: projectId, is_archived: false, is_trashed: { $ne: true } });
    const doneStatuses = await TaskStatus.find({ project_id: projectId, category: 'done' }).select('_id');
    const completedTasks = await Task.countDocuments({ 
        project_id: projectId, 
        is_archived: false,
        is_trashed: { $ne: true },
        status_id: { $in: doneStatuses.map(s => s._id) } 
    });

    res.json({
        done: true,
        body: {
            projectId,
            totalTasks,
            completedTasks,
            avgProgress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            completionPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            lastUpdated: new Date()
        }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get assignees for a project
 * @route   GET /api/tasks/assignees/:projectId
 * @access  Private
 */
exports.getAssignees = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const projectMembers = await ProjectMember.find({ project_id: projectId, is_active: true })
      .populate('user_id', 'name email avatar_url');
    
    const assignees = projectMembers.map(m => {
      if (!m.user_id) return null;
      return {
        id: m.user_id._id,
        name: m.user_id.name,
        email: m.user_id.email,
        avatar_url: m.user_id.avatar_url,
        project_member_id: m._id
      };
    }).filter(Boolean);

    res.json({ done: true, body: assignees });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get task list grouped (v3)
 * @route   GET /api/tasks/list/v3/:projectId
 * @access  Private
 */
exports.getTaskListV3 = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { group, search, archived, parent_task, members, labels, priorities, statuses, field, order } = req.query;
    const mongoose = require('mongoose');
    const projectMeta = await Project.findById(projectId).select('key').lean();
    const projectKeyPrefix =
      String(projectMeta?.key || 'TASK')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10) || 'TASK';

    const query = { project_id: projectId, is_trashed: { $ne: true } };
    if (archived === 'true') query.is_archived = true;
    else query.is_archived = false;

    if (search) query.name = { $regex: search, $options: 'i' };
    
    // Explicitly handle subtasks vs main tasks
    if (
      parent_task &&
      parent_task !== 'undefined' &&
      parent_task !== 'null' &&
      parent_task !== ''
    ) {
        query.parent_task_id = parent_task;
    } else {
        // Treat empty-string parent ids as top-level as well (legacy-safe).
        query.$or = [
          { parent_task_id: null },
          { parent_task_id: { $exists: false } }
        ];
    }

    // Robust parameter normalization for filters
    const parseFilter = (param) => {
        if (!param) return [];
        if (Array.isArray(param)) return param.flat().filter(p => !!p);
        return String(param).trim().split(/\s+/).filter(p => p.length > 0);
    };

    const labelIds = parseFilter(labels);
    const memberIds = parseFilter(members);
    const priorityIds = parseFilter(priorities);
    const statusIds = parseFilter(statuses);

    if (labelIds.length > 0) {
        const validObjectIds = labelIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        query.labels = { $in: [...validObjectIds, ...labelIds] };
    }

    if (memberIds.length > 0) {
        const validObjectIds = memberIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        query.assignees = { $in: [...validObjectIds, ...memberIds] };
    }

    if (priorityIds.length > 0) {
        query.priority = { $in: priorityIds };
    }

    if (statusIds.length > 0) {
        const validObjectIds = statusIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        query.status_id = { $in: [...validObjectIds, ...statusIds] };
    }

    console.log('[getTaskListV3] Generated Query:', JSON.stringify(query, null, 2));

    // Sorting
    let sort = { sort_order: 1, created_at: -1 };
    if (field && order) {
        let sortField = field.toString().toLowerCase();
        if (sortField === 'key' || sortField === 'task_key') sortField = 'task_key'; 
        if (sortField === 'name' || sortField === 'title') sortField = 'name';
        if (sortField === 'status') sortField = 'status_id';
        if (sortField === 'priority') sortField = 'priority';
        
        const sortOrderDirection = order.toString().toLowerCase() === 'desc' ? -1 : 1;
        sort = { [sortField]: sortOrderDirection };
    }

    const tasks = await Task.find(query)
      .populate('status_id', 'name color_code category')
      .populate('assignees', 'name email avatar_url')
      .populate('reporter_id', 'name email avatar_url')
      .populate('labels', 'name color_code')
      .populate('phase_id', 'name color_code')
      .sort(sort)
      .lean();

    if (tasks.length > 0 && (labels || members)) {
        console.log('[getTaskListV3] Debug: First task labels:', JSON.stringify(tasks[0].labels, null, 2));
        console.log('[getTaskListV3] Debug: Filter Labels:', labels);
    }

    // Backfill missing task keys and normalize old keys (EM1 -> EM-1).
    if (tasks.some(t => !t.task_key || (typeof t.task_key === 'string' && !t.task_key.includes('-')))) {
      const project = await Project.findById(projectId).select('key').lean();
      const prefix = String(project?.key || 'TASK')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10) || 'TASK';
      const prefixRegex = new RegExp(`^${prefix}-?(\\d+)$`);

      const existingKeys = await Task.find({
        project_id: projectId,
        task_key: { $type: 'string', $ne: '' },
      })
        .select('_id task_key')
        .lean();

      let maxNumber = 0;
      const used = new Set();
      const bulkOps = [];
      for (const row of existingKeys) {
        const key = String(row?.task_key || '');
        const match = key.match(prefixRegex);
        if (match?.[1]) {
          const n = Number(match[1]);
          if (!Number.isNaN(n) && n > maxNumber) maxNumber = n;
          const normalized = `${prefix}-${n}`;
          used.add(normalized);
          if (normalized !== key) {
            bulkOps.push({
              updateOne: {
                filter: { _id: row._id },
                update: { $set: { task_key: normalized } },
              },
            });
          }
        } else {
          used.add(key);
        }
      }

      const missing = tasks.filter(t => !t.task_key);
      for (const task of missing) {
        let next = maxNumber + 1;
        let candidate = `${prefix}-${next}`;
        while (used.has(candidate)) {
          next += 1;
          candidate = `${prefix}-${next}`;
        }
        maxNumber = next;
        used.add(candidate);
        task.task_key = candidate;

        bulkOps.push({
          updateOne: {
            filter: { _id: task._id },
            update: { $set: { task_key: candidate } },
          },
        });
      }

        if (bulkOps.length > 0) {
        await Task.bulkWrite(bulkOps);
      }
    }

    // Get time logs for all tasks to calculate time tracking
    const taskIds = tasks.map(t => t._id);
    // Aggregate time logs
    const timeLogs = await TimeLog.aggregate([
      { $match: { task_id: { $in: taskIds } } },
      { $group: { _id: '$task_id', totalHours: { $sum: '$hours' } } }
    ]);
    const timeLogMap = {};
    timeLogs.forEach(tl => {
      if (tl._id) {
        timeLogMap[tl._id.toString()] = tl.totalHours;
      }
    });

    // Get running timers for current user
    const runningTimers = await RunningTimer.find({ 
        user_id: req.user._id,
        task_id: { $in: taskIds }
    });
    const runningTimerMap = {};
    runningTimers.forEach(rt => {
        runningTimerMap[rt.task_id.toString()] = rt.start_time.getTime();
    });

    // Map user_id -> team_member_id so frontend receives assignable IDs
    // (checkbox/assignee socket expects team_member_id).
    const projectMemberLinks = await ProjectMember.find({
      project_id: projectId,
      is_active: true
    }).select('user_id team_member_id');
    const userToTeamMemberMap = {};
    projectMemberLinks.forEach(pm => {
      if (pm?.user_id && pm?.team_member_id) {
        userToTeamMemberMap[pm.user_id.toString()] = pm.team_member_id.toString();
      }
    });

    const formatTask = (t) => {
      const rawTaskKey = t.task_key ? String(t.task_key).toUpperCase() : '';
      const normalizedTaskKeyMatch = rawTaskKey.match(new RegExp(`^${projectKeyPrefix}-?(\\d+)$`));
      const normalizedTaskKey = normalizedTaskKeyMatch?.[1]
        ? `${projectKeyPrefix}-${Number(normalizedTaskKeyMatch[1])}`
        : rawTaskKey || null;
      const isDoneStatus = t.status_id?.category === 'done';
      const resolvedCompletedAt = t.completed_at || (isDoneStatus ? t.updated_at || null : null);

      return ({
        ...t,
        id: t._id.toString(),
        task_key: normalizedTaskKey,
        key: normalizedTaskKey,
        parent_task_id: t.parent_task_id ? t.parent_task_id.toString() : null,
        title: t.name, // Frontend expects 'title', backend stores as 'name'
        // Status
        status: t.status_id?._id?.toString(),
        status_id: t.status_id?._id?.toString(),
        status_name: t.status_id?.name,
        status_color: t.status_id?.color_code,
        status_color_dark: t.status_id?.color_code,
        // Priority
        priority: t.priority || 'medium',
        priority_color: t.priority === 'urgent' ? '#f50' : t.priority === 'high' ? '#ff9800' : t.priority === 'medium' ? '#2db7f5' : '#87d068',
        priority_color_dark: t.priority === 'urgent' ? '#f50' : t.priority === 'high' ? '#ff9800' : t.priority === 'medium' ? '#2db7f5' : '#87d068',
        // Phase
        phase_id: t.phase_id?._id?.toString() || null,
        phase_name: t.phase_id?.name || null,
        phase_color: t.phase_id?.color_code || null,
        // Dates
        start_date: t.start_date || null,
        startDate: t.start_date || null,
        end_date: t.end_date || null,
        due_date: t.end_date || t.due_date || null,
        dueDate: t.end_date || t.due_date || null,
        completed_at: resolvedCompletedAt,
        completedAt: resolvedCompletedAt,
        created_at: t.created_at || null,
        createdAt: t.created_at || null,
        updated_at: t.updated_at || null,
        updatedAt: t.updated_at || null,
        // Assignees
        assignees: t.assignees?.map(a => ({
            team_member_id: userToTeamMemberMap[a._id?.toString()] || a._id?.toString(),
            id: a._id?.toString(),
            name: a.name,
            email: a.email,
            avatar_url: a.avatar_url
        })) || [],
        assignee_names: t.assignees?.map(a => ({
            team_member_id: userToTeamMemberMap[a._id?.toString()] || a._id?.toString(),
            name: a.name,
            avatar_url: a.avatar_url
        })) || [],
        names: t.assignees || [], // InlineMember (legacy support)
        // Labels - include full label objects
        all_labels: t.labels?.map(l => ({
            id: l._id?.toString(),
            name: l.name,
            color_code: l.color_code
        })) || [],
        labels: t.labels?.map(l => ({
            id: l?._id?.toString(),
            name: l?.name,
            color: l?.color_code,
            color_code: l?.color_code
        })) || [],
        // Time tracking
        timeTracking: {
            total: (timeLogMap[t._id.toString()] || 0).toFixed(2),
            logged: (timeLogMap[t._id.toString()] || 0).toFixed(2),
            estimated: t.estimated_hours || 0,
            activeTimer: runningTimerMap[t._id.toString()] || null
        },
        total_logged_time: timeLogMap[t._id.toString()] || 0,
        // Progress
        progress: t.progress || 0,
        reporter: t.reporter_id?.name || null,
        reporter_id: t.reporter_id?._id?.toString?.() || null
      });
    };

    // Grouping logic
    let groups = [];
    if (group === 'status') {
        const statuses = await TaskStatus.find({ project_id: projectId }).sort({ sort_order: 1 });
        const statusIdSet = new Set(statuses.map(s => s._id.toString()));

        // Auto-heal: move tasks with deleted/missing status to a valid status
        // so "Unmapped Status" does not keep appearing in task list.
        if (statuses.length > 0) {
            const fallbackStatus = statuses.find(s => s.category === 'todo') || statuses[0];
            const orphanTaskIds = tasks
              .filter(t => {
                const taskStatusId = t.status_id?._id?.toString() || t.status_id?.toString();
                return !taskStatusId || !statusIdSet.has(taskStatusId);
              })
              .map(t => t._id);

            if (orphanTaskIds.length > 0) {
                await Task.updateMany(
                  { _id: { $in: orphanTaskIds } },
                  { $set: { status_id: fallbackStatus._id } }
                );

                tasks = tasks.map(t => {
                  const taskStatusId = t.status_id?._id?.toString() || t.status_id?.toString();
                  if (!taskStatusId || !statusIdSet.has(taskStatusId)) {
                    return { ...t, status_id: fallbackStatus._id };
                  }
                  return t;
                });
            }
        }
        const matchedTaskIds = new Set();

        groups = statuses.map(s => {
            const filteredTasks = tasks.filter(t => {
                const taskStatusId = t.status_id?._id?.toString() || t.status_id?.toString();
                const isMatch = taskStatusId === s._id.toString();
                if (isMatch) matchedTaskIds.add(t._id.toString());
                return isMatch;
            });
            return {
                id: s._id.toString(),
                title: s.name,
                groupType: 'status',
                groupValue: s._id.toString(),
                collapsed: false,
                tasks: filteredTasks.map(formatTask),
                taskIds: filteredTasks.map(t => t._id.toString()),
                color: s.color_code
            };
        });

        // Fallback for tasks with missing/deleted/unmatched statuses.
        const unmatchedTasks = tasks.filter(t => !matchedTaskIds.has(t._id.toString()));
        if (unmatchedTasks.length > 0) {
            groups.push({
                id: 'unmapped-status',
                title: 'Unmapped Status',
                groupType: 'status',
                groupValue: 'unmapped-status',
                collapsed: false,
                tasks: unmatchedTasks.map(formatTask),
                taskIds: unmatchedTasks.map(t => t._id.toString()),
                color: '#cccccc'
            });
        }

        // Absolute fallback: if no statuses exist but tasks are present.
        if (!groups.length && tasks.length > 0) {
            groups = [{
                id: 'all',
                title: 'Tasks',
                groupType: 'status',
                groupValue: 'all',
                collapsed: false,
                tasks: tasks.map(formatTask),
                taskIds: tasks.map(t => t._id.toString()),
                color: '#cccccc'
            }];
        }
    } else if (group === 'priority') {
        const priorities = [
            { id: 'urgent', name: 'Urgent', color: '#f50' },
            { id: 'high', name: 'High', color: '#ff9800' },
            { id: 'medium', name: 'Medium', color: '#2db7f5' },
            { id: 'low', name: 'Low', color: '#87d068' }
        ];
        groups = priorities.map(p => {
            const filteredTasks = tasks.filter(t => t.priority === p.id);
            return {
                id: p.id,
                title: p.name,
                groupType: 'priority',
                groupValue: p.id,
                collapsed: false,
                tasks: filteredTasks.map(formatTask),
                taskIds: filteredTasks.map(t => t._id.toString()),
                color: p.color
            };
        });
    } else if (group === 'phase') {
        const phases = await TaskPhase.find({ project_id: projectId }).sort({ sort_order: 1 });
        const matchedTaskIds = new Set();
        groups = phases.map(p => {
            const filteredTasks = tasks.filter(t => {
                const taskPhaseId = t.phase_id?._id?.toString() || t.phase_id?.toString();
                const isMatch = taskPhaseId === p._id.toString();
                if (isMatch) matchedTaskIds.add(t._id.toString());
                return isMatch;
            });
            return {
                id: p._id.toString(),
                title: p.name,
                groupType: 'phase',
                groupValue: p._id.toString(),
                collapsed: false,
                tasks: filteredTasks.map(formatTask),
                taskIds: filteredTasks.map(t => t._id.toString()),
                color: p.color_code
            };
        });

        const tasksWithoutPhase = tasks.filter(
          t => !t.phase_id || !matchedTaskIds.has(t._id.toString())
        );
        if (tasksWithoutPhase.length > 0) {
            groups.push({
                id: 'no-phase',
                title: 'No Phase',
                groupType: 'phase',
                groupValue: null,
                collapsed: false,
                tasks: tasksWithoutPhase.map(formatTask),
                taskIds: tasksWithoutPhase.map(t => t._id.toString()),
                color: '#cccccc'
            });
        }
    } else if (group === 'members') {
        const projectMembers = await ProjectMember.find({ project_id: projectId, is_active: true })
            .populate('user_id', 'name avatar_url');
        
        groups = projectMembers.map(m => {
            if (!m.user_id) return null;
            const filteredTasks = tasks.filter(t => t.assignees?.some(a => a._id?.toString() === m.user_id._id.toString()));
            return {
                id: m.user_id._id.toString(),
                title: m.user_id.name,
                groupType: 'members',
                groupValue: m.user_id._id.toString(),
                collapsed: false,
                tasks: filteredTasks.map(formatTask),
                taskIds: filteredTasks.map(t => t._id.toString()),
                color: '#1890ff'
            };
        }).filter(Boolean);

        const unassignedTasks = tasks.filter(t => !t.assignees || t.assignees.length === 0);
        if (unassignedTasks.length > 0) {
            groups.push({
                id: 'unassigned',
                title: 'Unassigned',
                groupType: 'members',
                groupValue: null,
                collapsed: false,
                tasks: unassignedTasks.map(formatTask),
                taskIds: unassignedTasks.map(t => t._id.toString()),
                color: '#cccccc'
            });
        }
    } else {
        groups = [{
            id: 'all',
            title: 'Tasks',
            groupType: 'status',
            groupValue: 'all',
            collapsed: false,
            tasks: tasks.map(formatTask),
            taskIds: tasks.map(t => t._id.toString()),
            color: '#cccccc'
        }];
    }

    res.json({ 
        done: true, 
        body: { 
            groups, 
            totalTasks: tasks.length,
            allTasks: tasks.map(formatTask),
            grouping: group || 'status'
        } 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get task list columns (standard)
 * @route   GET /api/tasks/list/columns/:projectId
 * @access  Private
 */
exports.getTaskListColumns = async (req, res, next) => {
  try {
    const columns = [
        { key: 'KEY', name: 'Key', show: true },
        { key: 'NAME', name: 'Name', show: true },
        { key: 'STATUS', name: 'Status', show: true },
        { key: 'PRIORITY', name: 'Priority', show: true },
        { key: 'ASSIGNEES', name: 'Assignees', show: true },
        { key: 'DUE_DATE', name: 'Due Date', show: true },
        { key: 'LABELS', name: 'Labels', show: true }
    ];
    res.json({ done: true, body: columns });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update column visibility
 * @route   PUT /api/tasks/list/columns/:projectId
 * @access  Private
 */
exports.updateColumnVisibility = async (req, res, next) => {
  try {
    res.json({ done: true });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get task info for forms (metadata for drawer)
 * @route   GET /api/tasks/info
 * @access  Private
 */
exports.getTaskInfo = async (req, res, next) => {
  try {
    const { task_id, project_id } = req.query;
    let task = null;
    let statuses = [];
    let members = [];
    let phases = [];
    let targetProjectId = project_id;
    let projectMembers = [];
    const userToTeamMemberMap = {};

    if (task_id && task_id !== 'null' && task_id !== 'undefined') {
        task = await Task.findById(task_id)
            .populate('status_id', 'name color_code')
            .populate('assignees', 'name email avatar_url')
            .populate('labels', 'name color_code')
            .populate('phase_id', 'name color_code');
        if (task && !targetProjectId) targetProjectId = task.project_id;
    }

    if (targetProjectId && targetProjectId !== 'null') {
        statuses = await TaskStatus.find({ project_id: targetProjectId }).sort({ sort_order: 1 });
        phases = await TaskPhase.find({ project_id: targetProjectId }).sort({ sort_order: 1 });
        projectMembers = await ProjectMember.find({ project_id: targetProjectId, is_active: true })
            .populate('user_id', 'name email avatar_url');

        projectMembers.forEach(pm => {
          if (pm?.user_id?._id && pm?.team_member_id) {
            userToTeamMemberMap[pm.user_id._id.toString()] = pm.team_member_id.toString();
          }
        });

        members = projectMembers.map(m => {
            if (!m.user_id) return null;
            return {
                id: m.team_member_id ? m.team_member_id.toString() : m.user_id._id.toString(),
                user_id: m.user_id._id.toString(),
                name: m.user_id.name,
                email: m.user_id.email,
                avatar_url: m.user_id.avatar_url,
                project_member_id: m._id
            };
        }).filter(Boolean);
    }

    const priorities = [
        { id: 'low', name: 'Low', color: '#87d068', color_code: '#87d068' },
        { id: 'medium', name: 'Medium', color: '#2db7f5', color_code: '#2db7f5' },
        { id: 'high', name: 'High', color: '#ff9800', color_code: '#ff9800' },
        { id: 'urgent', name: 'Urgent', color: '#f50', color_code: '#f50' }
    ];

    const normalizedTask = task
      ? (() => {
          const taskObj = task.toObject();
          const assigneeNames = (taskObj.assignees || []).map(a => {
            const userId = a?._id?.toString?.() || '';
            return {
              team_member_id: userToTeamMemberMap[userId] || userId,
              name: a?.name || '',
              avatar_url: a?.avatar_url || '',
            };
          });

          const labels = (taskObj.labels || []).map(l => ({
            id: l?._id?.toString?.() || '',
            name: l?.name || '',
            color_code: l?.color_code || '#1890ff',
          }));

          return {
            ...taskObj,
            id: taskObj._id?.toString?.() || taskObj._id,
            parent_task_id: taskObj.parent_task_id
              ? taskObj.parent_task_id.toString()
              : null,
            status_id: taskObj.status_id?._id?.toString?.() || taskObj.status_id || null,
            status_name: taskObj.status_id?.name || null,
            status_color: taskObj.status_id?.color_code || null,
            phase_id: taskObj.phase_id?._id?.toString?.() || taskObj.phase_id || null,
            phase_name: taskObj.phase_id?.name || null,
            phase_color: taskObj.phase_id?.color_code || null,
            priority_id: taskObj.priority || 'medium',
            due_date: taskObj.end_date || taskObj.due_date || null,
            dueDate: taskObj.end_date || taskObj.due_date || null,
            end_date: taskObj.end_date || taskObj.due_date || null,
            total_hours: Math.floor(Number(taskObj.estimated_hours || 0)),
            total_minutes: Math.round((Number(taskObj.estimated_hours || 0) % 1) * 60),
            progress_value:
              typeof taskObj.progress === 'number' ? taskObj.progress : 0,
            weight:
              typeof taskObj.weight === 'number' ? taskObj.weight : null,
            assignees: assigneeNames.map(a => a.team_member_id),
            assignee_names: assigneeNames,
            names: assigneeNames,
            labels,
            all_labels: labels,
          };
        })()
      : null;

    res.json({
        done: true,
        body: {
            task: normalizedTask,
            statuses,
            phases,
            members,
            team_members: members,
            priorities
        }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check task dependency status
 * @route   GET /api/tasks/dependency-status
 * @access  Private
 */
exports.getTaskDependencyStatus = async (req, res, next) => {
  try {
    const { taskId, statusId } = req.query;
    const TaskDependency = require('../models/TaskDependency');
    const Task = require('../models/Task');
    const TaskStatus = require('../models/TaskStatus');

    let targetCategory = null;
    if (statusId) {
      const ts = await TaskStatus.findById(statusId);
      if (ts) targetCategory = ts.category;
    }
    
    // Find all tasks that block this taskId
    const dependencies = await TaskDependency.find({ task_id: taskId }).populate({
      path: 'related_task_id',
      select: 'name task_key status_id',
      populate: { path: 'status_id', select: 'category' }
    });

    let canContinue = true;
    const blockingTasks = [];

    // Only block if we're trying to move to 'doing' or 'done'.
    // If we're moving back to 'todo', it shouldn't be blocked.
    if (!targetCategory || targetCategory === 'doing' || targetCategory === 'done') {
      for (const dep of dependencies) {
        if (dep.related_task_id) {
          const statusStr = dep.related_task_id.status_id?.category;
          if (statusStr !== 'done') {
            canContinue = false;
            blockingTasks.push({
              id: dep.related_task_id._id,
              name: dep.related_task_id.name,
              task_key: dep.related_task_id.task_key
            });
          }
        }
      }
    }

    res.json({
        done: true,
        body: {
            can_continue: canContinue,
            status: canContinue ? 'allowed' : 'blocked',
            blockingTasks
        }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get trashed tasks for current user
 * @route   GET /api/tasks/trash
 * @access  Private
 */
exports.getTrash = async (req, res, next) => {
  try {
    const { search } = req.query;

    const memberships = await ProjectMember.find({
      user_id: req.user._id,
      is_active: true,
    }).select('project_id');

    const projectIds = memberships.map(m => m.project_id);

    if (!projectIds.length) {
      return res.json({ done: true, body: [] });
    }

    const query = {
      project_id: { $in: projectIds },
      is_trashed: true,
    };

    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    const tasks = await Task.find(query)
      .populate('project_id', 'name')
      .populate('reporter_id', 'name email')
      .sort({ updated_at: -1 });

    return res.json({ done: true, body: tasks });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Restore tasks from trash
 * @route   PUT /api/tasks/trash/restore
 * @access  Private
 */
exports.restoreFromTrash = async (req, res, next) => {
  try {
    const taskIds = Array.isArray(req.body.task_ids) ? req.body.task_ids : [];

    if (!taskIds.length) {
      return res.status(400).json({ done: false, message: 'task_ids are required' });
    }

    const memberships = await ProjectMember.find({
      user_id: req.user._id,
      is_active: true,
    }).select('project_id');
    const projectIds = memberships.map(m => m.project_id);

    const tasksToRestore = await Task.find({
      _id: { $in: taskIds },
      project_id: { $in: projectIds },
      is_trashed: true,
    }).select('_id');

    const validIds = tasksToRestore.map(t => t._id);

    if (!validIds.length) {
      return res.json({ done: true, body: { matched: 0, modified: 0 } });
    }

    const [directRestoreResult, subtaskRestoreResult] = await Promise.all([
      Task.updateMany(
        {
          _id: { $in: validIds },
          is_trashed: true,
        },
        { $set: { is_trashed: false } }
      ),
      Task.updateMany(
        {
          parent_task_id: { $in: validIds },
          is_trashed: true,
        },
        { $set: { is_trashed: false } }
      ),
    ]);

    return res.json({
      done: true,
      body: {
        matched: (directRestoreResult.matchedCount || 0) + (subtaskRestoreResult.matchedCount || 0),
        modified: (directRestoreResult.modifiedCount || 0) + (subtaskRestoreResult.modifiedCount || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Permanently delete tasks from trash
 * @route   DELETE /api/tasks/trash
 * @access  Private
 */
exports.permanentlyDeleteFromTrash = async (req, res, next) => {
  try {
    const taskIds = Array.isArray(req.body.task_ids) ? req.body.task_ids : [];

    if (!taskIds.length) {
      return res.status(400).json({ done: false, message: 'task_ids are required' });
    }

    const memberships = await ProjectMember.find({
      user_id: req.user._id,
      is_active: true,
    }).select('project_id');
    const projectIds = memberships.map(m => m.project_id);

    const tasksToDelete = await Task.find({
      _id: { $in: taskIds },
      project_id: { $in: projectIds },
      is_trashed: true,
    }).select('_id');

    const validIds = tasksToDelete.map(t => t._id);

    if (!validIds.length) {
      return res.json({ done: true, body: { deleted: 0 } });
    }

    const result = await Task.deleteMany({
      $or: [
        { _id: { $in: validIds }, is_trashed: true },
        { parent_task_id: { $in: validIds }, is_trashed: true },
      ],
      project_id: { $in: projectIds },
    });

    return res.json({
      done: true,
      body: { deleted: result.deletedCount || 0 },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get task subscribers
 * @route   GET /api/tasks/subscribers/:id
 * @access  Private
 */
exports.getSubscribers = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ done: false, message: 'Task not found' });

    const fullTask = await Task.findById(req.params.id).populate(
      'subscribers',
      'name email avatar_url'
    );
    const subscriberUserIds = (fullTask?.subscribers || []).map(s => s?._id?.toString());

    if (!subscriberUserIds.length) {
      return res.json({ done: true, body: [] });
    }

    const teamMembers = await TeamMember.find({
      user_id: { $in: subscriberUserIds }
    }).select('_id user_id');

    const userToTeamMemberMap = {};
    teamMembers.forEach(tm => {
      if (tm?.user_id && tm?._id) {
        userToTeamMemberMap[tm.user_id.toString()] = tm._id.toString();
      }
    });

    const subscribers = (fullTask?.subscribers || []).map(u => ({
      team_member_id: userToTeamMemberMap[u?._id?.toString()] || u?._id?.toString(),
      name: u?.name || '',
      email: u?.email || '',
      avatar_url: u?.avatar_url || ''
    }));

    res.json({ done: true, body: subscribers });
  } catch (error) {
    next(error);
  }
};

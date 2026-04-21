const { Task, TaskStatus, Project, ProjectMember, TaskComment, TaskAttachment } = require('../models');
const notificationService = require('./notification.service');
const { generateTaskKeyForProject } = require('../utils/task-key');
const { sanitizeText, sanitizeRich } = require('../utils/sanitize');
const logger = require('../utils/logger');
const calendarSyncService = require('./calendar-sync.service');

/**
 * Task Service
 * Handles business logic for tasks
 */

/**
 * Create a new task with defaults and sanitization
 */
exports.createTask = async (data, reporterId) => {
  const { 
    name, description, project_id, status_id, priority,
    assignees, start_date, end_date, due_date, estimated_hours,
    parent_task_id, labels, phase_id
  } = data;

  // 1. Resolve Status
  let taskStatusId = status_id;
  if (!taskStatusId) {
    const defaultStatus = await TaskStatus.findOne({ project_id, is_default: true });
    if (defaultStatus) {
      taskStatusId = defaultStatus._id;
    } else {
      const firstStatus = await TaskStatus.findOne({ project_id }).sort({ sort_order: 1 });
      taskStatusId = firstStatus?._id;
    }
  }

  // 2. Generate Task Key
  const taskKey = await generateTaskKeyForProject(project_id);

  // 3. Create Task
  const task = await Task.create({
    name: sanitizeText(name),
    description: sanitizeRich(description),
    project_id,
    task_key: taskKey,
    status_id: taskStatusId,
    priority: priority || 'medium',
    assignees: assignees || [],
    reporter_id: reporterId,
    start_date,
    end_date,
    due_date,
    estimated_hours,
    parent_task_id: parent_task_id || null,
    labels,
    phase_id
  });
  
  if (task.due_date) {
    await calendarSyncService.syncTaskToCalendar(task);
  }

  // Notify Assignees
  if (assignees && Array.isArray(assignees)) {
    for (const userId of assignees) {
      notificationService.notifyTaskAssignment(task._id, userId, reporterId, 'add', project_id);
    }
  }

  return task;
};

/**
 * Delete a task (Move to trash)
 * Includes subtasks
 */
exports.deleteTask = async (taskId) => {
  const task = await Task.findById(taskId);
  if (!task) return null;

  // Move to trash
  task.is_trashed = true;
  task.is_archived = false;
  await task.save();

  await Task.updateMany(
    { parent_task_id: taskId },
    { is_trashed: true, is_archived: false }
  );

  await calendarSyncService.removeTaskFromCalendar(taskId);

  logger.info(`Task Service: Moved task ${taskId} and its subtasks to trash`);
  return task;
};

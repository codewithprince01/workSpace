const { CalendarEvent, Project } = require('../models');
const logger = require('../utils/logger');

/**
 * Sync Task Deadline to Calendar
 */
exports.syncTaskToCalendar = async (task) => {
  try {
    if (!task.due_date) {
      // If deadline was removed, delete the corresponding calendar event
      await CalendarEvent.deleteOne({ task_id: task._id });
      return;
    }

    // Get team_id from project if not on task
    let teamId = task.team_id;
    if (!teamId && task.project_id) {
       const project = await Project.findById(task.project_id).select('team_id');
       teamId = project?.team_id;
    }

    const eventData = {
      title: `Deadline: ${task.name}`,
      description: task.description || '',
      type: 'task_deadline',
      start_time: task.due_date,
      end_time: task.due_date,
      all_day: true,
      user_id: task.reporter_id || task.assignees[0], // Arbitrary fallback
      assigned_user_id: task.assignees && task.assignees.length > 0 ? task.assignees[0] : null,
      team_id: teamId,
      project_id: task.project_id,
      task_id: task._id,
      priority: task.priority || 'medium',
      color: '#f5222d', // Red for deadlines
    };

    // Upsert the event
    await CalendarEvent.findOneAndUpdate(
      { task_id: task._id },
      eventData,
      { upsert: true, new: true }
    );

    logger.debug(`Calendar Sync: Synced task deadline for "${task.name}"`);
  } catch (error) {
    logger.error('Calendar Sync Error:', error);
  }
};

/**
 * Remove Task from Calendar
 */
exports.removeTaskFromCalendar = async (taskId) => {
  try {
    await CalendarEvent.deleteMany({ task_id: taskId });
    logger.debug(`Calendar Sync: Removed task ${taskId} from calendar`);
  } catch (error) {
    logger.error('Calendar Sync Error (remove):', error);
  }
};

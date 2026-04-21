const { Notification, User } = require('../models');
const logger = require('../utils/logger');

/**
 * Notification Service
 * Handles creation and distribution of notifications
 */

/**
 * Create a notification for a user
 * @param {Object} data - Notification data
 * @param {string} data.user_id - Recipient user ID
 * @param {string} data.type - Notification type
 * @param {string} data.message - Notification message
 * @param {string} [data.project_id] - Related project ID
 * @param {string} [data.task_id] - Related task ID
 * @param {string} [data.team_id] - Related team ID
 */
exports.createNotification = async (data) => {
  try {
    const { user_id, type, message, project_id, task_id, team_id, meta } = data;

    if (!user_id || !type || !message) {
      logger.error('Notification Service: Missing required fields', { user_id, type, message });
      return null;
    }

    const notification = await Notification.create({
      user_id,
      type,
      message,
      project_id,
      task_id,
      team_id,
      meta
    });

    // Handle real-time delivery via Socket.io
    try {
      const { emitToUser } = require('../sockets');
      if (emitToUser) {
        const SocketEvents = require('../config/socket-events');
        emitToUser(user_id, SocketEvents.NOTIFICATIONS_UPDATE.toString(), notification);
      }
    } catch (e) {
      // Socket not yet initialized or other load error
    }
    
    return notification;
  } catch (error) {
    logger.error('Notification Service: Error creating notification', error);
    return null;
  }
};

/**
 * Notify task assigned/unassigned
 */
exports.notifyTaskAssignment = async (taskId, userId, assignerId, mode, projectId) => {
  try {
    if (String(userId) === String(assignerId)) return null; // Don't notify self

    const [user, assigner, task] = await Promise.all([
      User.findById(userId).select('name'),
      User.findById(assignerId).select('name'),
      require('../models/Task').findById(taskId).select('name project_id').populate('project_id', 'name')
    ]);

    if (!user || !assigner || !task) return null;

    const type = mode === 'add' ? 'task_assigned' : 'task_updated';
    const message = mode === 'add' 
      ? `**${assigner.name}** has assigned you in **${task.name}**`
      : `**${assigner.name}** has removed you from **${task.name}**`;

    return await this.createNotification({
      user_id: userId,
      type,
      message,
      project_id: projectId || task.project_id?._id || task.project_id,
      task_id: taskId,
      meta: {
        sender_name: assigner.name,
        project_name: task.project_id?.name || 'Project'
      }
    });
  } catch (error) {
    logger.error('Notification Service: Error in notifyTaskAssignment', error);
    return null;
  }
};

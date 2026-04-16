const { CalendarEvent, TeamMember, User } = require('../models');
const logger = require('./logger');

/**
 * Check if user can edit a calendar event
 * @param {Object} user - The user object
 * @param {Object} event - The calendar event object
 * @returns {Promise<boolean>} - True if user can edit the event
 */
async function canEditEvent(user, event) {
  try {
    // Admin/Owner can edit everything
    if (user.is_admin || user.is_owner) {
      logger.info(`[Permission] User ${user._id} is admin/owner - allowed`);
      return true;
    }

    // Get user ID
    const userId = user._id.toString();

    // Get event user ID - handle both ObjectId and populated object
    let eventUserId = null;
    if (event.user_id) {
      if (typeof event.user_id === 'object' && event.user_id._id) {
        eventUserId = event.user_id._id.toString();
      } else {
        eventUserId = event.user_id.toString();
      }
    }

    logger.info(`[Permission] Checking: eventUserId=${eventUserId}, userId=${userId}, event.team_id=${event.team_id}, event.user_id type=${typeof event.user_id}`);

    // User created the event can edit it (works for both personal and team events)
    if (eventUserId && eventUserId === userId) {
      logger.info(`[Permission] User ${userId} created the event - allowed`);
      return true;
    }

    // Team admin/owner can edit team events (only if team_id is set)
    if (event.team_id) {
      const teamMembership = await TeamMember.findOne({
        user_id: user._id,
        team_id: event.team_id,
        is_active: true
      });

      if (teamMembership && (teamMembership.role === 'owner' || teamMembership.role === 'admin')) {
        logger.info(`[Permission] User ${userId} is team admin/owner - allowed`);
        return true;
      }
    }

    logger.warn(`[Permission] User ${userId} denied access to event ${event._id}`);
    return false;
  } catch (error) {
    logger.error('Error checking edit permission:', error);
    return false;
  }
}

/**
 * Check if user can delete a calendar event
 * @param {Object} user - The user object
 * @param {Object} event - The calendar event object
 * @returns {Promise<boolean>} - True if user can delete the event
 */
async function canDeleteEvent(user, event) {
  // Same logic as edit permission
  return canEditEvent(user, event);
}

/**
 * Check if user can create events
 * All authenticated users can create events
 * @param {Object} user - The user object
 * @returns {boolean} - True if user can create events
 */
function canCreateEvent(user) {
  return !!user; // Any authenticated user can create events
}

/**
 * Get user's role in a team
 * @param {Object} user - The user object
 * @param {string} teamId - The team ID
 * @returns {Promise<string|null>} - The role (owner/admin/member) or null
 */
async function getUserTeamRole(user, teamId) {
  try {
    if (!teamId) return null;

    const teamMembership = await TeamMember.findOne({
      user_id: user._id,
      team_id: teamId,
      is_active: true
    });

    return teamMembership ? teamMembership.role : null;
  } catch (error) {
    logger.error('Error getting user team role:', error);
    return null;
  }
}

module.exports = {
  canEditEvent,
  canDeleteEvent,
  canCreateEvent,
  getUserTeamRole,
};

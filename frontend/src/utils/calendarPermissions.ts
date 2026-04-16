import { ICalendarEvent } from '@/api/calendar/calendar.api.service';

/**
 * Check if user can edit a calendar event
 * @param user - The user object (any type with is_admin, is_owner, _id properties)
 * @param event - The calendar event object
 * @param userTeamId - The user's current team ID
 * @param userTeamRole - The user's role in the team (owner/admin/member)
 * @returns True if user can edit the event
 */
export function canEditEvent(
  user: any | null,
  event: ICalendarEvent,
  userTeamId?: string | null,
  userTeamRole?: string | null
): boolean {
  if (!user) return false;

  // Admin/Owner can edit everything
  if (user.is_admin || user.is_owner) {
    return true;
  }

  // Get user ID from either id or _id field
  const userId = user.id || user._id;

  // User created the event can edit it (works for both personal and team events)
  const eventUserId = typeof event.user_id === 'object' 
    ? event.user_id._id 
    : event.user_id;
  
  if (eventUserId === userId) {
    return true;
  }

  // Team admin/owner can edit team events (only for team mode)
  const eventTeamId = event.team_id ? (typeof event.team_id === 'object' 
    ? event.team_id._id 
    : event.team_id) : null;

  // Only check team permissions if this is a team event (eventTeamId is not null)
  if (eventTeamId && eventTeamId === userTeamId) {
    if (userTeamRole === 'owner' || userTeamRole === 'admin') {
      return true;
    }
  }

  return false;
}

/**
 * Check if user can delete a calendar event
 * @param user - The user object (any type with is_admin, is_owner, _id properties)
 * @param event - The calendar event object
 * @param userTeamId - The user's current team ID
 * @param userTeamRole - The user's role in the team (owner/admin/member)
 * @returns True if user can delete the event
 */
export function canDeleteEvent(
  user: any | null,
  event: ICalendarEvent,
  userTeamId?: string | null,
  userTeamRole?: string | null
): boolean {
  // Same logic as edit permission
  return canEditEvent(user, event, userTeamId, userTeamRole);
}

/**
 * Check if user can create events
 * All authenticated users can create events
 * @param user - The user object
 * @returns True if user can create events
 */
export function canCreateEvent(user: any | null): boolean {
  return !!user; // Any authenticated user can create events
}

/**
 * Get permission error message
 * @returns Error message for UI display
 */
export function getPermissionError(): string {
  return 'You can only edit your own events';
}

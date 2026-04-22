const { CalendarEvent, TeamMember, User, Project } = require('../models');
const logger = require('../utils/logger');
const { canEditEvent, canDeleteEvent } = require('../utils/calendarPermissions');
const emailService = require('../services/email.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────────────────────────
// GET /api/calendar/events
// ─────────────────────────────────────────────────────────────
exports.getEvents = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      start, end, type, priority,
      project_id, assigned_user_id
    } = req.query;

    logger.info(`[Calendar Fetch] userId=${userId}, project_id=${project_id}`);

    // ── STRICT VISIBILITY QUERY ─────────────────────────────────────
    // Fetch events where user is creator OR user is in assigned list
    const query = {
      is_archived: false,
      $or: [
        { user_id: userId },
        { assigned_user_ids: userId },
        { assigned_user_id: userId } // Backward compatibility
      ]
    };

    // Filter by project if provided
    if (project_id && project_id !== 'undefined') {
      query.project_id = project_id;
    }

    // ── DATE RANGE ───────────────────────────────────────────────
    if (start && end) {
      query.start_time = { $gte: new Date(start), $lte: new Date(end) };
    }

    // ── OPTIONAL UI FILTERS ──────────────────────────────────────
    if (type) query.type = type;
    if (priority) query.priority = priority;

    logger.info(`[Calendar Query] MongoDB Filter: ${JSON.stringify(query)}`);

    const events = await CalendarEvent.find(query)
      .populate('user_id', 'name email avatar_url')
      .populate('assigned_user_ids', 'name email avatar_url')
      .sort({ start_time: 1 })
      .lean();

    logger.info(`[Calendar Fetch Result] Found ${events.length} visible events for user ${userId}`);

    return res.json({ done: true, body: events });
  } catch (error) {
    logger.error('getEvents error:', error);
    return res.status(500).json({ done: false, message: 'Failed to fetch events' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/calendar/events/:id
// ─────────────────────────────────────────────────────────────
exports.getEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id)
      .populate('user_id', 'name email avatar_url')
      .populate('assigned_user_id', 'name email avatar_url')
      .populate('assigned_user_ids', 'name email avatar_url')
      .populate('team_id', 'name')
      .lean();

    if (!event) {
      return res.status(404).json({ done: false, message: 'Event not found' });
    }

    return res.json({ done: true, body: event });
  } catch (error) {
    logger.error('getEvent error:', error);
    return res.status(500).json({ done: false, message: 'Failed to fetch event' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/calendar/events
// ─────────────────────────────────────────────────────────────
exports.createEvent = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      title, description, type, start_time, end_time, all_day,
      assigned_user_ids, project_id, task_id, priority,
      mood, energy_level, mood_tags, color, reminder_minutes,
      event_scope, external_assigned_emails
    } = req.body;

    // 1. STRICT SAVE LOGIC
    const finalAssignedUserIds = Array.isArray(assigned_user_ids) ? assigned_user_ids : [];
    const finalExternalAssignedEmails = Array.isArray(external_assigned_emails)
      ? [...new Set(external_assigned_emails
          .map(email => String(email || '').trim().toLowerCase())
          .filter(email => EMAIL_REGEX.test(email)))]
      : [];

    const event = new CalendarEvent({
      title,
      description: description || '',
      type,
      start_time: new Date(start_time),
      end_time: end_time ? new Date(end_time) : null,
      all_day: all_day || false,
      user_id: userId,
      assigned_user_ids: finalAssignedUserIds,
      external_assigned_emails: finalExternalAssignedEmails,
      is_all_members: false, // Always false as per requirement
      event_scope: event_scope || 'personal',
      project_id: project_id || null,
      task_id: task_id || null,
      priority: priority || 'medium',
      mood: mood || null,
      reminder_minutes: reminder_minutes || [],
      // Extra mood fields
      ...(mood ? {
        energy_level,
        mood_tags: mood_tags || [],
      } : {}),
    });

    // Logging for Step 5
    logger.info(`[Calendar SAVE Logic] project_id=${project_id}, assigned_user_ids=${JSON.stringify(finalAssignedUserIds)}, creator=${userId}`);

    const savedEvent = await event.save();

    logger.info(`[Calendar DB Verify] _id=${savedEvent._id}, stored_assigned_user_ids=${JSON.stringify(savedEvent.assigned_user_ids)}`);

    const [creator, assignedUsers, project] = await Promise.all([
      User.findById(userId).select('name email').lean(),
      finalAssignedUserIds.length
        ? User.find({ _id: { $in: finalAssignedUserIds } }).select('name email').lean()
        : Promise.resolve([]),
      project_id ? Project.findById(project_id).select('name').lean() : Promise.resolve(null),
    ]);

    const emailRecipients = [
      ...assignedUsers.map(user => ({
        email: user.email,
        name: user.name,
      })),
      ...finalExternalAssignedEmails.map(email => ({
        email,
        name: '',
      })),
    ]
      .filter(recipient => recipient.email)
      .filter((recipient, index, list) =>
        list.findIndex(item => item.email.toLowerCase() === recipient.email.toLowerCase()) === index
      );

    if (emailRecipients.length) {
      await Promise.allSettled(
        emailRecipients.map(recipient =>
          emailService.sendCalendarAssignmentEmail({
            toEmail: recipient.email,
            recipientName: recipient.name,
            creatorName: creator?.name,
            eventTitle: title,
            eventType: type,
            startTime: start_time,
            endTime: end_time,
            allDay: all_day || false,
            description: description || '',
            priority: priority || 'medium',
            projectName: project?.name || '',
          })
        )
      );
    }

    const populated = await CalendarEvent.findById(savedEvent._id)
      .populate('user_id', 'name email avatar_url')
      .populate('assigned_user_ids', 'name email avatar_url')
      .lean();

    return res.status(201).json({ done: true, body: populated });
  } catch (error) {
    logger.error('createEvent error:', error);
    return res.status(500).json({ done: false, message: 'Failed to create event' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/calendar/events/:id
// ─────────────────────────────────────────────────────────────
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.start_time) updates.start_time = new Date(updates.start_time);
    if (updates.end_time) updates.end_time = new Date(updates.end_time);

    if (updates.hasOwnProperty('assigned_user_ids')) {
      updates.assigned_user_ids = Array.isArray(updates.assigned_user_ids) ? updates.assigned_user_ids : [];
    }
    if (updates.hasOwnProperty('external_assigned_emails')) {
      updates.external_assigned_emails = Array.isArray(updates.external_assigned_emails)
        ? [...new Set(updates.external_assigned_emails
            .map(email => String(email || '').trim().toLowerCase())
            .filter(email => EMAIL_REGEX.test(email)))]
        : [];
    }
    updates.is_all_members = false;

    const event = await CalendarEvent.findById(id);
    if (!event) return res.status(404).json({ done: false, message: 'Event not found' });

    const hasPermission = await canEditEvent(req.user, event);
    if (!hasPermission) return res.status(403).json({ done: false, message: 'Permission denied' });

    const updatedEvent = await CalendarEvent.findByIdAndUpdate(id, updates, { new: true })
      .populate('user_id', 'name email avatar_url')
      .populate('assigned_user_ids', 'name email avatar_url');

    logger.info(`[Calendar Update Logic] id=${id}, updated_assigned_user_ids=${JSON.stringify(updatedEvent.assigned_user_ids)}`);

    return res.json({ done: true, body: updatedEvent });
  } catch (error) {
    logger.error('updateEvent error:', error);
    return res.status(500).json({ done: false, message: 'Failed to update event' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/calendar/events/:id
// ─────────────────────────────────────────────────────────────
exports.deleteEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ done: false, message: 'Event not found' });

    const hasPermission = await canDeleteEvent(req.user, event);
    if (!hasPermission) return res.status(403).json({ done: false, message: 'Permission denied' });

    await CalendarEvent.findByIdAndDelete(req.params.id);
    return res.json({ done: true, message: 'Event deleted' });
  } catch (error) {
    logger.error('deleteEvent error:', error);
    return res.status(500).json({ done: false, message: 'Failed to delete event' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/calendar/moods?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
exports.getTeamMoods = async (req, res) => {
  try {
    const userId = req.user._id;
    const { date } = req.query;

    if (!date) return res.status(400).json({ done: false, message: 'Date is required' });

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const memberships = await TeamMember.find({ user_id: userId, is_active: true }).select('team_id');
    const teamIds = memberships.map(m => m.team_id).filter(Boolean);

    const moods = await CalendarEvent.find({
      type: 'mood_entry',
      start_time: { $gte: dayStart, $lte: dayEnd },
      $or: [
        { user_id: userId },
        { team_id: { $in: teamIds } }
      ]
    })
      .populate('user_id', 'name email avatar_url')
      .sort({ created_at: -1 })
      .lean();

    return res.json({ done: true, body: moods });
  } catch (error) {
    logger.error('getTeamMoods error:', error);
    return res.status(500).json({ done: false, message: 'Failed to fetch moods' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/calendar/team-members
// ─────────────────────────────────────────────────────────────
exports.getTeamMembers = async (req, res) => {
  try {
    const userId = req.user._id;
    const memberships = await TeamMember.find({ user_id: userId, is_active: true }).select('team_id');
    const teamIds = memberships.map(m => m.team_id).filter(Boolean);

    const allMembers = await TeamMember.find({ team_id: { $in: teamIds }, is_active: true })
      .populate('user_id', 'name email avatar_url')
      .lean();

    const seen = new Set();
    const unique = allMembers.filter(m => {
      if (!m.user_id) return false;
      const uid = m.user_id._id.toString();
      if (seen.has(uid)) return false;
      seen.add(uid);
      return true;
    }).map(m => m.user_id);

    return res.json({ done: true, body: unique });
  } catch (error) {
    logger.error('getTeamMembers error:', error);
    return res.status(500).json({ done: false, message: 'Failed to fetch team members' });
  }
};

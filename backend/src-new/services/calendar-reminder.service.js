const { CronJob } = require('cron');
const { CalendarEvent, Notification, User } = require('../models');
const { sendEmail } = require('./email.service');
const logger = require('../utils/logger');
const moment = require('moment');

/**
 * Initialize Calendar Reminder Cron Job
 * Runs every minute to check for upcoming events
 */
exports.initCalendarReminders = () => {
  logger.info('Calendar Reminder Job: Initializing...');

  // Run every minute: * * * * *
  const job = new CronJob('* * * * *', async () => {
    try {
      await checkAndSendReminders();
    } catch (error) {
      logger.error('Calendar Reminder Job error:', error);
    }
  });

  job.start();
  logger.info('Calendar Reminder Job: Started (running every minute)');
};

/**
 * Core logic to check events and send notifications
 */
async function checkAndSendReminders() {
  const now = moment();
  const nextHour = moment().add(1, 'hour');

  // Find events starting in the future that have reminders set
  // This is a simplified logic: 
  // We check for events where (start_time - reminder_minutes) is roughly "now"
  // And we haven't sent that specific reminder yet.
  
  // To avoid missing reminders, we look at a window
  const events = await CalendarEvent.find({
    is_archived: false,
    start_time: { 
      $gte: now.toDate(),
      $lte: moment().add(1, 'day').toDate() // Check for next 24 hours
    },
    reminder_minutes: { $exists: true, $not: { $size: 0 } }
  }).populate('user_id assigned_user_id assigned_user_ids');

  for (const event of events) {
    for (const minutes of event.reminder_minutes) {
      const reminderTime = moment(event.start_time).subtract(minutes, 'minutes');
      
      // If reminderTime is past and roughly within the last 2 minutes (to handle job latency)
      // and we haven't sent this reminder before.
      const isDue = now.isSameOrAfter(reminderTime) && now.diff(reminderTime, 'minutes') < 5;
      const alreadySent = event.reminders_sent && event.reminders_sent.includes(minutes);

      if (isDue && !alreadySent) {
        await sendNotification(event, minutes);
        
        // Mark as sent
        event.reminders_sent = event.reminders_sent || [];
        event.reminders_sent.push(minutes);
        await event.save();
      }
    }
  }
}

async function sendNotification(event, minutes) {
  const recipientsMap = new Map();

  // Helper to add a user to the recipients list, avoiding duplicates
  const addRecipient = (user) => {
    if (user && user._id && user.email) {
      recipientsMap.set(user._id.toString(), user);
    }
  };

  // Add the creator
  if (event.user_id) {
    addRecipient(event.user_id);
  }

  // Add single assigned user
  if (event.assigned_user_id) {
    addRecipient(event.assigned_user_id);
  }

  // Add multiple assigned users from assigned_user_ids array
  if (event.assigned_user_ids && Array.isArray(event.assigned_user_ids)) {
    for (const user of event.assigned_user_ids) {
      addRecipient(user);
    }
  }

  const recipients = Array.from(recipientsMap.values());

  const timeStr = minutes >= 60 
    ? `${Math.round(minutes/60)} hour(s)` 
    : `${minutes} minutes`;

  const message = `Reminder: "${event.title}" starts in ${timeStr}.`;

  // Send to all registered user recipients
  for (const user of recipients) {
    // 1. In-app notification
    try {
      await Notification.create({
        user_id: user._id,
        team_id: event.team_id,
        project_id: event.project_id,
        task_id: event.task_id,
        type: 'calendar_reminder',
        message: message
      });
      logger.info(`In-app reminder sent to ${user.email} for event ${event._id}`);
    } catch (err) {
      logger.error('Failed to create in-app notification:', err);
    }

    // 2. Email notification
    try {
      const subject = `Event Reminder: ${event.title}`;
      const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #1890ff;">Upcoming Event Reminder</h2>
          <p>Hello ${user.name || 'there'},</p>
          <p>This is a reminder for your upcoming event:</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">${event.title}</p>
            <p style="margin: 5px 0; color: #666;">Starts in: ${timeStr}</p>
            <p style="margin: 5px 0; color: #666;">Time: ${moment(event.start_time).format('MMMM Do YYYY, h:mm a')}</p>
          </div>
          ${event.description ? `<p><strong>Description:</strong><br/>${event.description}</p>` : ''}
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #9eadb6; font-size: 12px;">Sent by Workspace Calendar System</p>
        </div>
      `;
      
      await sendEmail({
        to: user.email,
        subject,
        html
      });
      logger.info(`Email reminder sent to ${user.email} for event ${event._id}`);
    } catch (err) {
      logger.error('Failed to send email reminder:', err);
    }
  }

  // 3. Send email to external assigned emails (who are not registered in DB)
  if (event.external_assigned_emails && Array.isArray(event.external_assigned_emails)) {
    const existingEmails = new Set(recipients.map(u => u.email.toLowerCase().trim()));

    for (const extEmail of event.external_assigned_emails) {
      const trimmedExtEmail = extEmail?.toLowerCase()?.trim();
      if (trimmedExtEmail && !existingEmails.has(trimmedExtEmail)) {
        try {
          const subject = `Event Reminder: ${event.title}`;
          const html = `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #1890ff;">Upcoming Event Reminder</h2>
              <p>Hello,</p>
              <p>This is a reminder for your upcoming event:</p>
              <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-size: 18px; font-weight: bold;">${event.title}</p>
                <p style="margin: 5px 0; color: #666;">Starts in: ${timeStr}</p>
                <p style="margin: 5px 0; color: #666;">Time: ${moment(event.start_time).format('MMMM Do YYYY, h:mm a')}</p>
              </div>
              ${event.description ? `<p><strong>Description:</strong><br/>${event.description}</p>` : ''}
              <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="color: #9eadb6; font-size: 12px;">Sent by Workspace Calendar System</p>
            </div>
          `;

          await sendEmail({
            to: extEmail,
            subject,
            html
          });
          logger.info(`External email reminder sent to ${extEmail} for event ${event._id}`);
        } catch (err) {
          logger.error(`Failed to send external email reminder to ${extEmail}:`, err);
        }
      }
    }
  }
}

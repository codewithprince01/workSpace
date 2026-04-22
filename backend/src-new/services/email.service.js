const nodemailer = require('nodemailer');
const { SES, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const constants = require('../config/constants');
const logger = require('../utils/logger');

let transporter;

/**
 * Initialize Email Transporter
 */
const initTransporter = () => {
  if (transporter) return transporter;

  const provider = constants.MAIL_PROVIDER.toLowerCase();
  
  try {
    if (provider === 'ses' && process.env.AWS_ACCESS_KEY_ID) {
      logger.info('Email Service: Initializing AWS SES transport');
      const ses = new SES({
        region: constants.SES_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      transporter = nodemailer.createTransport({
        SES: { ses, aws: { SendRawEmailCommand } },
      });
    } else if (provider === 'smtp' && constants.SMTP_HOST) {
      logger.info(`Email Service: Initializing SMTP transport (${constants.SMTP_HOST})`);
      transporter = nodemailer.createTransport({
        host: constants.SMTP_HOST,
        port: constants.SMTP_PORT,
        secure: constants.SMTP_PORT === 465,
        auth: {
          user: constants.SMTP_USER,
          pass: constants.SMTP_PASS,
        },
      });
    } else {
      if (provider !== 'console') {
        logger.warn(`Email Service: Provider '${provider}' not configured. Falling back to console.`);
      }
      transporter = null; // Signal console logging
    }
  } catch (error) {
    logger.error('Email Service: Failed to initialize transporter: %s', error.message);
    transporter = null;
  }

  return transporter;
};

/**
 * Send email
 * @param {Object} options - { to, subject, html, text }
 */
exports.sendEmail = async ({ to, subject, html, text }) => {
  const mailTransporter = initTransporter();
  const mailOptions = {
    from: constants.MAIL_FROM,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>?/gm, ''), // Simple HTML to Text fallback
  };

  if (!mailTransporter) {
    logger.info('📧 [MOCK EMAIL]');
    logger.info(`To: ${to}`);
    logger.info(`Subject: ${subject}`);
    logger.debug(`Body: ${html.substring(0, 100)}...`);
    return { success: true, message: 'Email logged to console' };
  }

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Email sending failed: %s', error.message);
    // Don't throw, just return success: false so caller can handle gracefully
    return { success: false, error: error.message };
  }
};

/**
 * Send project invitation email
 */
exports.sendProjectInviteEmail = async (toEmail, inviterName, projectName, inviteLink, role) => {
  const safeInviter = inviterName || 'A teammate';
  const safeProjectName = projectName || 'a project';
  const subject = `${safeInviter} has invited you to work with ${safeInviter} in Worklenz`;
  
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#ffffff; color:#111827; max-width:620px; margin:0 auto; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <div style="padding:24px;">
        <h2 style="margin:0 0 10px 0; font-size:22px; color:#111827;">Join your team on Worklenz</h2>
        <p style="margin:0 0 14px 0; font-size:14px; color:#4b5563;">Hi,</p>
        <p style="margin:0 0 12px 0; font-size:15px; line-height:1.5;">
          <strong>${safeInviter}</strong> has invited you to work with <strong>${safeInviter}</strong> in Worklenz.
        </p>
        <p style="margin:0 0 6px 0; font-size:14px; color:#374151;">
          Project: <strong>${safeProjectName}</strong>
        </p>
        <p style="margin:0 0 18px 0; font-size:14px; color:#374151;">
          Role: <strong style="text-transform:capitalize;">${role || 'member'}</strong>
        </p>

        <div style="margin: 24px 0; text-align: left;">
          <a href="${inviteLink}" style="background-color:#1890ff; color:#ffffff; padding:12px 22px; text-decoration:none; border-radius:8px; font-weight:700; display:inline-block;">
            Join Worklenz
          </a>
        </div>

        <p style="margin:0 0 8px 0; font-size:13px; color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="margin:0; word-break:break-all; font-size:13px;">
          <a href="${inviteLink}" style="color:#1890ff;">${inviteLink}</a>
        </p>
      </div>
      <div style="border-top:1px solid #e5e7eb; padding:14px 24px; font-size:12px; color:#6b7280;">
        If you have any questions, contact us at support@worklenz.com.
      </div>
    </div>
  `;

  return exports.sendEmail({
    to: toEmail,
    subject,
    html
  });
};

exports.sendCalendarAssignmentEmail = async ({
  toEmail,
  recipientName,
  creatorName,
  eventTitle,
  eventType,
  startTime,
  endTime,
  allDay,
  description,
  priority,
  projectName,
}) => {
  const safeRecipient = recipientName || 'there';
  const safeCreator = creatorName || 'A teammate';
  const safeTitle = eventTitle || 'Untitled event';
  const safeType = (eventType || 'event').replace(/_/g, ' ');
  const formattedStart = startTime
    ? new Date(startTime).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: allDay ? undefined : 'numeric',
        minute: allDay ? undefined : '2-digit',
        hour12: true,
      })
    : '-';
  const formattedEnd = endTime
    ? new Date(endTime).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: allDay ? undefined : 'numeric',
        minute: allDay ? undefined : '2-digit',
        hour12: true,
      })
    : null;

  const subject = `New event assigned: ${safeTitle}`;
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#f7f8fa; padding:24px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
        <div style="padding:24px 24px 8px;">
          <h2 style="margin:0 0 12px; font-size:22px; color:#111827;">You have been assigned a calendar event</h2>
          <p style="margin:0; font-size:14px; line-height:1.6; color:#4b5563;">
            Hi ${safeRecipient}, ${safeCreator} assigned you to an event in Worklenz.
          </p>
        </div>
        <div style="padding:16px 24px 24px;">
          <div style="border:1px solid #e5e7eb; border-radius:10px; padding:18px; background:#f9fafb;">
            <p style="margin:0 0 12px; font-size:20px; font-weight:700; color:#111827;">${safeTitle}</p>
            <p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Type:</strong> ${safeType}</p>
            <p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Date:</strong> ${formattedStart}</p>
            ${formattedEnd ? `<p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Ends:</strong> ${formattedEnd}</p>` : ''}
            <p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>All day:</strong> ${allDay ? 'Yes' : 'No'}</p>
            <p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Priority:</strong> ${priority || 'medium'}</p>
            ${projectName ? `<p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Project:</strong> ${projectName}</p>` : ''}
            ${description ? `<div style="margin-top:14px;"><p style="margin:0 0 6px; font-size:14px; font-weight:700; color:#111827;">Details</p><p style="margin:0; font-size:14px; line-height:1.6; color:#4b5563; white-space:pre-wrap;">${description}</p></div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  return exports.sendEmail({
    to: toEmail,
    subject,
    html,
  });
};

const nodemailer = require('nodemailer');
const { SES, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const constants = require('../config/constants');
const logger = require('../utils/logger');

console.log('[EmailService] Loading module...');

let transporter;

/**
 * Initialize Email Transporter
 */
const initTransporter = () => {
  if (transporter) return transporter;

  const provider = (constants.MAIL_PROVIDER || 'console').toLowerCase();
  console.log(`[EmailService] Initializing with provider: ${provider}`);
  
  try {
    if (provider === 'ses' && process.env.AWS_ACCESS_KEY_ID) {
      console.log('[EmailService] Using AWS SES');
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
      console.log(`[EmailService] Using SMTP: ${constants.SMTP_HOST}:${constants.SMTP_PORT} (User: ${constants.SMTP_USER})`);
      
      const smtpConfig = {
        host: constants.SMTP_HOST,
        port: constants.SMTP_PORT,
        secure: constants.SMTP_PORT === 465,
        auth: {
          user: constants.SMTP_USER,
          pass: constants.SMTP_PASS,
        },
        // MilesWeb/cPanel often use self-signed certs, so we relax TLS validation
        tls: {
          rejectUnauthorized: false
        }
      };

      transporter = nodemailer.createTransport(smtpConfig);
      
      // Verify connection immediately
      transporter.verify((error, success) => {
        if (error) {
          console.error(`[EmailService] SMTP Verification FAILED: ${error.message}`);
          logger.error('Email Service: SMTP Verification FAILED: %s', error.message);
        } else {
          console.log('[EmailService] SMTP server is READY');
          logger.info('Email Service: SMTP server is ready to take our messages');
        }
      });
    } else {
      console.log(`[EmailService] Falling back to CONSOLE logging (Provider: ${provider})`);
      transporter = null;
    }
  } catch (error) {
    console.error(`[EmailService] Initialization error: ${error.message}`);
    transporter = null;
  }

  return transporter;
};

// Auto-initialize on load
initTransporter();

/**
 * Send email
 * @param {Object} options - { to, subject, html, text }
 */
exports.sendEmail = async ({ to, subject, html, text }) => {
  const mailTransporter = initTransporter();
  const normalizedTo = String(to || '').trim().toLowerCase();
  const mailOptions = {
    from: constants.MAIL_FROM,
    to: normalizedTo,
    subject,
    html,
    text: text || html.replace(/<[^>]*>?/gm, ''), // Simple HTML to Text fallback
  };

  if (!mailTransporter) {
    console.log('📧 [MOCK EMAIL SENT]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    return { success: true, message: 'Email logged to console' };
  }

  try {
    console.log(`[EmailService] Sending email to ${normalizedTo}...`);
    const info = await mailTransporter.sendMail(mailOptions);
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    const response = info.response || '';

    console.log(`[EmailService] SMTP response: ${response}`);
    console.log(`[EmailService] Accepted: ${accepted.join(', ') || '-'}`);
    console.log(`[EmailService] Rejected: ${rejected.join(', ') || '-'}`);

    if (rejected.length > 0 || accepted.length === 0) {
      return {
        success: false,
        error: `SMTP accepted=${accepted.length}, rejected=${rejected.length}, response=${response}`,
        messageId: info.messageId,
      };
    }

    console.log(`[EmailService] SUCCESS: ${info.messageId}`);
    return { success: true, messageId: info.messageId, accepted, response };
  } catch (error) {
    console.error(`[EmailService] FAILED to ${normalizedTo}: ${error.message}`);
    if (error.code === 'EAUTH') {
      console.error('[EmailService] AUTH ERROR: Check your credentials or App Password');
    }
    return { success: false, error: error.message };
  }
};

/**
 * Send project invitation email
 */
exports.sendProjectInviteEmail = async (toEmail, inviterName, projectName, inviteLink, role) => {
  const safeInviter = inviterName || 'A teammate';
  const safeProjectName = projectName || 'a project';
  const subject = `${safeInviter} has invited you to work with ${safeInviter} in Workspace`;
  
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#ffffff; color:#111827; max-width:620px; margin:0 auto; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <div style="padding:24px;">
        <h2 style="margin:0 0 10px 0; font-size:22px; color:#111827;">Join your team on Workspace</h2>
        <p style="margin:0 0 14px 0; font-size:14px; color:#4b5563;">Hi,</p>
        <p style="margin:0 0 12px 0; font-size:15px; line-height:1.5;">
          <strong>${safeInviter}</strong> has invited you to work with <strong>${safeInviter}</strong> in Workspace.
        </p>
        <p style="margin:0 0 6px 0; font-size:14px; color:#374151;">
          Project: <strong>${safeProjectName}</strong>
        </p>
        <p style="margin:0 0 18px 0; font-size:14px; color:#374151;">
          Role: <strong style="text-transform:capitalize;">${role || 'member'}</strong>
        </p>

        <div style="margin: 24px 0; text-align: left;">
          <a href="${inviteLink}" style="background-color:#1890ff; color:#ffffff; padding:12px 22px; text-decoration:none; border-radius:8px; font-weight:700; display:inline-block;">
            Join Workspace
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

/**
 * Send project addition notification email (for existing team members)
 */
exports.sendProjectAdditionEmail = async (toEmail, inviterName, projectName, role) => {
  const safeInviter = inviterName || 'A teammate';
  const safeProjectName = projectName || 'a project';
  const subject = `You have been added to ${safeProjectName} by ${safeInviter}`;
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const projectLink = `${frontendUrl}/workspace/projects`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#ffffff; color:#111827; max-width:620px; margin:0 auto; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <div style="padding:24px;">
        <h2 style="margin:0 0 10px 0; font-size:22px; color:#111827;">You've been added to a new project</h2>
        <p style="margin:0 0 14px 0; font-size:14px; color:#4b5563;">Hi,</p>
        <p style="margin:0 0 12px 0; font-size:15px; line-height:1.5;">
          <strong>${safeInviter}</strong> has added you to the project <strong>${safeProjectName}</strong> in Workspace.
        </p>
        <p style="margin:0 0 18px 0; font-size:14px; color:#374151;">
          Role: <strong style="text-transform:capitalize;">${role || 'member'}</strong>
        </p>

        <div style="margin: 24px 0; text-align: left;">
          <a href="${projectLink}" style="background-color:#1890ff; color:#ffffff; padding:12px 22px; text-decoration:none; border-radius:8px; font-weight:700; display:inline-block;">
            View Projects
          </a>
        </div>
      </div>
      <div style="border-top:1px solid #e5e7eb; padding:14px 24px; font-size:12px; color:#6b7280;">
        Workspace Team
      </div>
    </div>
  `;

  return exports.sendEmail({
    to: toEmail,
    subject,
    html
  });
};

/**
 * Send team invitation email
 */
exports.sendTeamInviteEmail = async (toEmail, inviterName, teamName, inviteLink, role) => {
  const safeInviter = inviterName || 'A teammate';
  const safeTeamName = teamName || 'a team';
  const subject = `${safeInviter} has invited you to join ${safeTeamName} on Workspace`;
  
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#ffffff; color:#111827; max-width:620px; margin:0 auto; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <div style="padding:24px;">
        <h2 style="margin:0 0 10px 0; font-size:22px; color:#111827;">You've been invited!</h2>
        <p style="margin:0 0 14px 0; font-size:14px; color:#4b5563;">Hi,</p>
        <p style="margin:0 0 12px 0; font-size:15px; line-height:1.5;">
          <strong>${safeInviter}</strong> has invited you to join the team <strong>${safeTeamName}</strong> on Workspace.
        </p>
        <p style="margin:0 0 18px 0; font-size:14px; color:#374151;">
          Role: <strong style="text-transform:capitalize;">${role || 'member'}</strong>
        </p>

        <div style="margin: 24px 0; text-align: left;">
          <a href="${inviteLink}" style="background-color:#1890ff; color:#ffffff; padding:12px 22px; text-decoration:none; border-radius:8px; font-weight:700; display:inline-block;">
            Join Team
          </a>
        </div>
        
        <p style="margin:24px 0 0 0; font-size:13px; color:#6b7280; line-height:1.4;">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="${inviteLink}" style="color:#1890ff;">${inviteLink}</a>
        </p>
      </div>
      <div style="border-top:1px solid #e5e7eb; padding:14px 24px; font-size:12px; color:#6b7280;">
        Workspace Team
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
  const formattedDate = startTime
    ? new Date(startTime).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '-';
  const formattedTime = !allDay && startTime
    ? new Date(startTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  const subject = `You have been invited to a ${safeType} by ${safeCreator}`;
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#f7f8fa; padding:24px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
        <div style="padding:24px 24px 8px;">
          <h2 style="margin:0 0 12px; font-size:22px; color:#111827;">You have been invited to a ${safeType}</h2>
          <p style="margin:0; font-size:14px; line-height:1.6; color:#4b5563;">
            Hi ${safeRecipient}, ${safeCreator} created an event and included you in it.
          </p>
        </div>
        <div style="padding:16px 24px 24px;">
          <div style="border:1px solid #e5e7eb; border-radius:10px; padding:18px; background:#f9fafb;">
            <p style="margin:0 0 12px; font-size:20px; font-weight:700; color:#111827;">${safeTitle}</p>
            <p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Date:</strong> ${formattedDate}</p>
            ${formattedTime ? `<p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Time:</strong> ${formattedTime}</p>` : ''}
            <p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Organized by:</strong> ${safeCreator}</p>
            <p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Priority:</strong> ${priority || 'medium'}</p>
            ${projectName ? `<p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Project:</strong> ${projectName}</p>` : ''}
            <div style="margin-top:14px;">
              <p style="margin:0 0 6px; font-size:14px; font-weight:700; color:#111827;">Message</p>
              <p style="margin:0; font-size:14px; line-height:1.6; color:#4b5563; white-space:pre-wrap;">${description || 'Please check the calendar for full event details.'}</p>
            </div>
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

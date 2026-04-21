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

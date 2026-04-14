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
  const subject = `${inviterName} invited you to join ${projectName} on Worklenz`;
  
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #1890ff;">You've been invited!</h2>
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> has invited you to join the project <strong>${projectName}</strong> as a <strong>${role}</strong> on Worklenz.</p>
      
      <div style="margin: 40px 0; text-align: center;">
        <a href="${inviteLink}" style="background-color: #1890ff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
      </div>
      
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all;"><a href="${inviteLink}" style="color: #1890ff;">${inviteLink}</a></p>
      
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #9eadb6; font-size: 12px;">This invitation was sent by Worklenz. If you weren't expecting this, you can safely ignore this email.</p>
    </div>
  `;

  return exports.sendEmail({
    to: toEmail,
    subject,
    html
  });
};

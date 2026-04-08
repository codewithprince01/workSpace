/**
 * Email Service
 * Handles sending emails for the application.
 * Currently prints to console for development/demo purposes.
 */

exports.sendEmail = async ({ to, subject, html, text }) => {
  console.log('====================================================');
  console.log('📧 MOCK EMAIL SERVICE');
  console.log('----------------------------------------------------');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('----------------------------------------------------');
  console.log('Body (HTML Preview):');
  console.log(html); // In production, this would be sent via SMTP/API
  console.log('====================================================');
  
  // Return a resolved promise to simulate async operation
  return Promise.resolve({ success: true, message: 'Email logged to console' });
};

exports.sendProjectInviteEmail = async (toEmail, inviterName, projectName, inviteLink, role) => {
  const subject = `${inviterName} invited you to join ${projectName} on Worklenz`;
  
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2>You've been invited!</h2>
      <p><strong>${inviterName}</strong> has invited you to join the project <strong>${projectName}</strong> as a <strong>${role}</strong>.</p>
      
      <div style="margin: 30px 0;">
        <a href="${inviteLink}" style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Invitation</a>
      </div>
      
      <p>Or click this link: <a href="${inviteLink}">${inviteLink}</a></p>
      
      <p style="color: #666; font-size: 12px; margin-top: 40px;">This link will expire in 7 days.</p>
    </div>
  `;

  return exports.sendEmail({
    to: toEmail,
    subject,
    html
  });
};

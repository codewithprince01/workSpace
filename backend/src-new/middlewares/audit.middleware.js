const { AuditLog } = require('../models');

/**
 * Logs a super admin action to the audit log.
 * Fire-and-forget — never throws to avoid blocking the main request.
 */
const logSuperAdminAction = async ({
  superAdmin,
  teamId,
  teamName,
  action,
  resourceType = null,
  resourceId = null,
  resourceName = null,
  mode = 'view',
  metadata = {},
  ip = null
}) => {
  try {
    await AuditLog.create({
      super_admin_id: superAdmin._id,
      super_admin_name: superAdmin.name,
      target_team_id: teamId || null,
      target_team_name: teamName || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId || null,
      resource_name: resourceName,
      mode,
      metadata,
      ip_address: ip
    });
  } catch (err) {
    // Non-critical — don't crash on audit failure
    console.error('[AuditLog] Failed to write audit log:', err.message);
  }
};

module.exports = { logSuperAdminAction };

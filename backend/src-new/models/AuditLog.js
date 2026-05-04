const mongoose = require('mongoose');
const { Schema } = mongoose;

const auditLogSchema = new Schema({
  // Who performed the action
  super_admin_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  super_admin_name: {
    type: String,
    required: true
  },
  // Which organization was accessed
  target_team_id: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    default: null,
    index: true
  },
  target_team_name: {
    type: String,
    default: null
  },
  // What was done
  action: {
    type: String,
    required: true,
    // e.g. 'SWITCH_ORG', 'VIEW_PROJECTS', 'VIEW_MEMBERS', 'EDIT_PROJECT', 'DELETE_TASK', 'TOGGLE_MANAGE_MODE'
  },
  resource_type: {
    type: String,
    default: null // 'project', 'task', 'member', 'team', etc.
  },
  resource_id: {
    type: Schema.Types.ObjectId,
    default: null
  },
  resource_name: {
    type: String,
    default: null
  },
  mode: {
    type: String,
    enum: ['view', 'manage'],
    default: 'view'
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  ip_address: {
    type: String,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

auditLogSchema.index({ super_admin_id: 1, created_at: -1 });
auditLogSchema.index({ target_team_id: 1, created_at: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

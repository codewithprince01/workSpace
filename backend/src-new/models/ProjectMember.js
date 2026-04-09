const mongoose = require('mongoose');
const { Schema } = mongoose;

const projectMemberSchema = new Schema({
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team_member_id: {
    type: Schema.Types.ObjectId,
    ref: 'TeamMember'
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member', 'viewer'],
    default: 'member'
  },
  is_active: {
    type: Boolean,
    default: true
  },
  pending_invitation: {
    type: Boolean,
    default: false
  },
  default_view: {
    type: String,
    enum: ['list', 'board', 'gantt', 'calendar'],
    default: 'list'
  },
  is_favorite: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index for unique project membership
projectMemberSchema.index({ project_id: 1, user_id: 1 }, { unique: true });
projectMemberSchema.index({ user_id: 1 });

module.exports = mongoose.model('ProjectMember', projectMemberSchema);

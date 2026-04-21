const mongoose = require('mongoose');
const { Schema } = mongoose;

const teamMemberSchema = new Schema({
  team_id: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  },
  job_title: {
    type: String,
    default: null
  },
  manager_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  },
  pending_invitation: {
    type: Boolean,
    default: false
  },
  joined_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index for unique team membership
teamMemberSchema.index({ team_id: 1, user_id: 1 }, { unique: true });
teamMemberSchema.index({ user_id: 1 });

module.exports = mongoose.model('TeamMember', teamMemberSchema);

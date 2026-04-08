const mongoose = require('mongoose');
const { Schema } = mongoose;

const projectSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [200, 'Project name cannot exceed 200 characters']
  },
  key: {
    type: String,
    required: true,
    uppercase: true,
    maxlength: [10, 'Project key cannot exceed 10 characters']
  },
  description: {
    type: String,
    default: null
  },
  team_id: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  owner_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  color_code: {
    type: String,
    default: '#1890ff'
  },
  status: {
    type: String,
    enum: ['active', 'on_hold', 'completed', 'cancelled'],
    default: 'active'
  },
  health: {
    type: String,
    enum: ['good', 'at_risk', 'critical'],
    default: 'good'
  },
  start_date: Date,
  end_date: Date,
  estimated_hours: {
    type: Number,
    default: 0
  },
  actual_hours: {
    type: Number,
    default: 0
  },
  is_archived: {
    type: Boolean,
    default: false
  },
  is_public: {
    type: Boolean,
    default: false
  },
  category_id: {
    type: Schema.Types.ObjectId,
    ref: 'ProjectCategory',
    default: null
  },
  folder_id: {
    type: Schema.Types.ObjectId,
    ref: 'ProjectFolder',
    default: null
  },
  settings: {
    default_view: {
      type: String,
      enum: ['list', 'board', 'gantt', 'calendar'],
      default: 'list'
    },
    show_completed_tasks: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
projectSchema.index({ team_id: 1 });
projectSchema.index({ owner_id: 1 });
projectSchema.index({ key: 1, team_id: 1 }, { unique: true });
projectSchema.index({ is_archived: 1 });

module.exports = mongoose.model('Project', projectSchema);

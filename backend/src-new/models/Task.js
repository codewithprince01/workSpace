const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Task name is required'],
    trim: true,
    maxlength: [500, 'Task name cannot exceed 500 characters']
  },
  description: {
    type: String,
    default: null
  },
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  task_key: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  status_id: {
    type: Schema.Types.ObjectId,
    ref: 'TaskStatus',
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignees: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  subscribers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  reporter_id: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  parent_task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  start_date: Date,
  end_date: Date,
  due_date: Date,
  estimated_hours: {
    type: Number,
    default: 0
  },
  actual_hours: {
    type: Number,
    default: 0
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  weight: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  sort_order: {
    type: Number,
    default: 0
  },
  labels: [{
    type: Schema.Types.ObjectId,
    ref: 'TaskLabel'
  }],
  phase_id: {
    type: Schema.Types.ObjectId,
    ref: 'TaskPhase',
    default: null
  },
  is_archived: {
    type: Boolean,
    default: false
  },
  is_trashed: {
    type: Boolean,
    default: false
  },
  custom_column_values: {
    type: Schema.Types.Mixed,
    default: {}
  },
  completed_at: Date,
  billable: {
    type: Boolean,
    default: false
  },
  schedule_id: {
    type: Schema.Types.ObjectId,
    ref: 'RecurringSchedule',
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Indexes for common queries
taskSchema.index({ project_id: 1, status_id: 1 });
taskSchema.index({ project_id: 1, is_archived: 1 });
taskSchema.index({ project_id: 1, is_trashed: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ parent_task_id: 1 });
taskSchema.index({ due_date: 1 });

// Virtual for subtasks count
taskSchema.virtual('subtasks_count', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'parent_task_id',
  count: true
});

module.exports = mongoose.model('Task', taskSchema);

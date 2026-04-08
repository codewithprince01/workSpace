const mongoose = require('mongoose');
const { Schema } = mongoose;

const activityLogSchema = new Schema({
  task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  done_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  log_type: {
    type: String,
    enum: ['create', 'update', 'delete', 'comment', 'status', 'priority', 'assignee', 'due_date', 'other'],
    default: 'update'
  },
  log_text: {
    type: String,
    required: true
  },
  attribute_type: {
    type: String, // 'STATUS', 'PRIORITY', 'PHASE', etc. matching frontend IActivityLogAttributeTypes
    default: null
  },
  previous: {
    type: Schema.Types.Mixed,
    default: null
  },
  current: {
    type: Schema.Types.Mixed,
    default: null
  },
  // Store snapshot of related objects for history?
  previous_status: { type: Schema.Types.Mixed }, // Snapshot or ID
  next_status: { type: Schema.Types.Mixed },
  
  // For other attribute types... 
  // keeping it simple with mixed fields
  
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

activityLogSchema.index({ task_id: 1, created_at: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

const mongoose = require('mongoose');
const { Schema } = mongoose;

const timeLogSchema = new Schema({
  task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hours: {
    type: Number,
    required: true,
    min: 0
  },
  description: String,
  logged_date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

timeLogSchema.index({ task_id: 1 });
timeLogSchema.index({ user_id: 1, logged_date: -1 });

module.exports = mongoose.model('TimeLog', timeLogSchema);

const mongoose = require('mongoose');
const { Schema } = mongoose;

const runningTimerSchema = new Schema({
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
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  start_time: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

runningTimerSchema.index({ user_id: 1 });
runningTimerSchema.index({ task_id: 1 });

module.exports = mongoose.model('RunningTimer', runningTimerSchema);

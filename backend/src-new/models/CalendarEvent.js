const mongoose = require('mongoose');
const { Schema } = mongoose;

const calendarEventSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ''
  },
  type: {
    type: String,
    enum: ['webinar', 'meeting', 'reminder', 'task_deadline', 'team_note', 'mood_entry'],
    required: true,
    default: 'meeting'
  },
  start_time: {
    type: Date,
    required: true
  },
  end_time: {
    type: Date
  },
  all_day: {
    type: Boolean,
    default: false
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assigned_user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  assigned_user_ids: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  external_assigned_emails: {
    type: [String],
    default: []
  },
  is_all_members: {
    type: Boolean,
    default: false,
    index: true
  },
  team_id: {
    type: Schema.Types.ObjectId,
    ref: 'Team'
  },
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  mood: {
    type: String,
    enum: ['amazing', 'happy', 'neutral', 'sad', 'stressed', null],
    default: null
  },
  energy_level: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  mood_tags: {
    type: [String],
    default: []
  },
  color: {
    type: String,
    default: null
  },
  reminder_minutes: {
    type: [Number],
    default: [60] // default: 1 hour before
  },
  reminders_sent: {
    type: [Number],
    default: []
  },
  is_recurring: {
    type: Boolean,
    default: false
  },
  recurrence_rule: {
    type: String,
    default: null
  },
  is_archived: {
    type: Boolean,
    default: false
  },
  event_scope: {
    type: String,
    enum: ['personal', 'team'],
    default: 'personal',
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Performance indexes
calendarEventSchema.index({ start_time: 1, end_time: 1 });
calendarEventSchema.index({ user_id: 1, start_time: 1 });
calendarEventSchema.index({ team_id: 1, start_time: 1 });
calendarEventSchema.index({ type: 1 });
calendarEventSchema.index({ task_id: 1 }, { sparse: true });
calendarEventSchema.index({ assigned_user_id: 1 }, { sparse: true });
calendarEventSchema.index({ assigned_user_ids: 1 }, { sparse: true });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);

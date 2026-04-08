const mongoose = require('mongoose');
const { Schema } = mongoose;

const customColumnSchema = new Schema({
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  key: {
    type: String,
    required: true, // nanoid or similar key used by frontend
    trim: true
  },
  field_type: {
    type: String, // 'text', 'number', 'date', 'checkbox', 'people', 'select', etc.
    required: true
  },
  width: {
    type: Number,
    default: 150
  },
  is_visible: {
    type: Boolean,
    default: true
  },
  pinned: {
    type: Boolean,
    default: false
  },
  configuration: {
    type: Schema.Types.Mixed, // Stores specific config like options for select, number formatting, etc.
    default: {}
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index for unique column names/keys within a project
customColumnSchema.index({ project_id: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('CustomColumn', customColumnSchema);

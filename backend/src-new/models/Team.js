const mongoose = require('mongoose');
const { Schema } = mongoose;

const teamSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters']
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
  is_active: {
    type: Boolean,
    default: true
  },
  logo_url: {
    type: String,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
teamSchema.index({ owner_id: 1 });
teamSchema.index({ name: 1, owner_id: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);

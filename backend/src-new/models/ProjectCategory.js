const mongoose = require('mongoose');
const { Schema } = mongoose;

const projectCategorySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  color_code: {
    type: String,
    default: '#1890ff'
  },
  team_id: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  is_archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('ProjectCategory', projectCategorySchema);

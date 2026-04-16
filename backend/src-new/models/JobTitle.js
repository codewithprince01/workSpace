const mongoose = require('mongoose');

const JobTitleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  team_id: {
    type: mongoose.Schema.Types.ObjectId,
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

module.exports = mongoose.model('JobTitle', JobTitleSchema);

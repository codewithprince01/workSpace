const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz')
  .then(() => console.log('Connected'))
  .catch(err => console.error(err));

async function run() {
  try {
      const ProjectMember = mongoose.models.ProjectMember || mongoose.model('ProjectMember', new Schema({ 
          project_id: { type: Schema.Types.ObjectId, ref: 'Project' },
          user_id: { type: Schema.Types.ObjectId, ref: 'User' },
          is_favorite: { type: Boolean, default: false },
          is_active: { type: Boolean, default: true }
      }));
      const Project = mongoose.models.Project || mongoose.model('Project', new Schema({ 
          name: String, 
          is_archived: { type: Boolean, default: false } 
      }));

      // Find user via 'Prince Saini' project
      const p = await Project.findOne({ name: 'Prince Saini' });
      if(!p) { console.log('Project Prince Saini not found'); return; }
      
      const m = await ProjectMember.findOne({ project_id: p._id }).populate('user_id');
      if(!m) { console.log('No member found for project'); return; }
      
      const userId = m.user_id._id;
      console.log('Testing for User:', userId);

      // Simulate Dashboard 'Favorites' Query (view=1)
      const membershipQuery = { user_id: userId, is_active: true, is_favorite: true };
      const favMembers = await ProjectMember.find(membershipQuery);
      console.log('Favorites from ProjectMember:', favMembers.length);
      
      const pIds = favMembers.map(m => m.project_id);
      const projects = await Project.find({ _id: { $in: pIds }, is_archived: false });
      
      console.log('--- DASHBOARD FAVORITES LIST ---');
      projects.forEach(p => console.log(`[${p.name}]`));
      
      const isTargetPresent = projects.find(proj => proj._id.toString() === p._id.toString());
      console.log('Is Prince Saini in list?', !!isTargetPresent);

  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

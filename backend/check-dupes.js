const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz')
  .then(() => console.log('Connected'))
  .catch(err => console.error(err));

async function run() {
  try {
      const Project = mongoose.models.Project || mongoose.model('Project', new Schema({ name: String }));
      const ProjectMember = mongoose.models.ProjectMember || mongoose.model('ProjectMember', new Schema({ 
          project_id: { type: Schema.Types.ObjectId, ref: 'Project' },
          user_id: { type: Schema.Types.ObjectId, ref: 'User' },
          is_favorite: { type: Boolean, default: false }
      }));
      const User = mongoose.models.User || mongoose.model('User', new Schema({ name: String, email: String }));

      const projects = await Project.find({ name: 'Prince Saini' });
      const p = projects[0];
      
      const members = await ProjectMember.find({ project_id: p._id });
      console.log(`Total Members: ${members.length}`);
      
      const userCounts = {};
      for (const m of members) {
          const u = await User.findById(m.user_id);
          const uname = u ? u.name : 'Unknown';
          const uid = m.user_id.toString();
          console.log(`Member: ${uname} (${uid}) - Fav: ${m.is_favorite} - ID: ${m._id}`);
          userCounts[uid] = (userCounts[uid] || 0) + 1;
      }
      
      console.log('Duplicates check:', userCounts);

  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

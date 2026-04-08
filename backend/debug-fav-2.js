const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

async function run() {
  try {
      // Define partial schemas (use try-catch for model compilation to avoid OverwriteModelError if running multiple times in same process, though here it's a script)
      const Project = mongoose.models.Project || mongoose.model('Project', new Schema({ name: String, is_archived: Boolean }));
      const ProjectMember = mongoose.models.ProjectMember || mongoose.model('ProjectMember', new Schema({ 
          project_id: { type: Schema.Types.ObjectId, ref: 'Project' },
          user_id: { type: Schema.Types.ObjectId, ref: 'User' },
          is_favorite: Boolean,
          is_active: Boolean
      }));
      const User = mongoose.models.User || mongoose.model('User', new Schema({ name: String, email: String }));

      const projects = await Project.find({ name: { $in: ['Prince Saini', 'just education'] } });
      console.log('Found Projects:', projects.length);
      
      for (const p of projects) {
          console.log(`Project: ${p.name} (${p._id})`);
          const members = await ProjectMember.find({ project_id: p._id });
          for (const m of members) {
              const u = await User.findById(m.user_id);
              console.log(`  - Member: ${u ? u.name : 'Unknown'} (${m.user_id}) | Fav: ${m.is_favorite} | Active: ${m.is_active}`);
          }
      }
  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

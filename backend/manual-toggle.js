const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

async function run() {
  try {
      const Project = mongoose.models.Project || mongoose.model('Project', new Schema({ name: String, is_archived: Boolean }));
      const ProjectMember = mongoose.models.ProjectMember || mongoose.model('ProjectMember', new Schema({ 
          project_id: { type: Schema.Types.ObjectId, ref: 'Project' },
          user_id: { type: Schema.Types.ObjectId, ref: 'User' },
          is_favorite: { type: Boolean, default: false },
          is_active: Boolean
      }));

      const projects = await Project.find({ name: 'Prince Saini' });
      const p = projects[0];
      if (!p) { console.log('Project not found'); return; }

      const members = await ProjectMember.find({ project_id: p._id });
      for (const m of members) {
          console.log(`Original Status: Fav=${m.is_favorite}`);
          m.is_favorite = true; 
          await m.save();
          console.log(`Updated Status: Fav=${m.is_favorite}`);
      }
      
      const check = await ProjectMember.find({ project_id: p._id });
      console.log(`Check Status: Fav=${check[0].is_favorite}`);

  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

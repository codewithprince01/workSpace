const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz')
  .then(() => console.log('Connected'))
  .catch(err => console.error(err));

async function run() {
  try {
      // Need to define User schema to allow population
      if (!mongoose.models.User) {
        mongoose.model('User', new Schema({ name: String, email: String }));
      }
      const Project = mongoose.models.Project || mongoose.model('Project', new Schema({ 
          name: String, 
          is_archived: { type: Boolean, default: false },
          team_id: Schema.Types.ObjectId 
        }));
      
      const ProjectMember = mongoose.models.ProjectMember || mongoose.model('ProjectMember', new Schema({ 
          project_id: { type: Schema.Types.ObjectId, ref: 'Project' },
          user_id: { type: Schema.Types.ObjectId, ref: 'User' },
          is_favorite: { type: Boolean, default: false },
          is_active: { type: Boolean, default: true }
      }));

      // 1. Find the project 'Prince Saini'
      const projects = await Project.find({ name: 'Prince Saini' });
      const p = projects[0];
      if (!p) { console.log('Project not found'); return; }

      // 2. Find the user (assuming the user who had the issues)
      const members = await ProjectMember.find({ project_id: p._id }).populate('user_id');
      if (members.length === 0) { console.log('No members'); return; }
      
      const member = members[0]; // Assuming this is the test user
      const userId = member.user_id._id;

      console.log(`Test for User: ${userId} on Project: ${p._id}`);

      // 3. Set favorite = true explicitly
      await ProjectMember.findOneAndUpdate({ _id: member._id }, { is_favorite: true });
      console.log('Set favorite = true');

      // 4. Simulate getAll with starred=true
      const starredMembers = await ProjectMember.find({ user_id: userId, is_favorite: true, is_active: true });
      const starredIds = starredMembers.map(m => m.project_id);
      const starredProjects = await Project.find({ _id: { $in: starredIds }, is_archived: false });
      
      const isPresent = starredProjects.find(sp => sp._id.toString() === p._id.toString());
      console.log(`[Validation 1] Is in Favorites list? ${!!isPresent} (Expected: true)`);
      
      if (!isPresent) {
          console.log('Start members dump:', starredMembers);
          console.log('Project dump:', p);
      }

      // 5. Toggle to false
      await ProjectMember.findOneAndUpdate({ _id: member._id }, { is_favorite: false });
      console.log('Set favorite = false');

      // 6. Simulate getAll with starred=true again
      const starredMembers2 = await ProjectMember.find({ user_id: userId, is_favorite: true, is_active: true });
      const starredIds2 = starredMembers2.map(m => m.project_id);
      const starredProjects2 = await Project.find({ _id: { $in: starredIds2 }, is_archived: false });
      
      const isPresent2 = starredProjects2.find(sp => sp._id.toString() === p._id.toString());
      console.log(`[Validation 2] Is in Favorites list? ${!!isPresent2} (Expected: false)`);
      
      if (isPresent2) {
          console.log('Why is it still there?');
          const mCheck = await ProjectMember.findOne({ _id: member._id });
          console.log('Member status:', mCheck);
      }

  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

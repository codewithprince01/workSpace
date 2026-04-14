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
          is_favorite: Boolean
      }));

      const members = await ProjectMember.find({});
      console.log('Total entries:', members.length);
      
      const map = {};
      const dupesToDelete = [];
      
      for (const m of members) {
          const key = `${m.project_id}-${m.user_id}`;
          if (map[key]) {
              console.log('Found dupe:', key, m._id);
              dupesToDelete.push(m._id);
          } else {
              map[key] = true;
          }
      }
      
      console.log('Deleting', dupesToDelete.length, 'duplicates');
      if (dupesToDelete.length > 0) {
        await ProjectMember.deleteMany({ _id: { $in: dupesToDelete } });
      }
      console.log('Deleted.');
      
      // Ensure index again
      try {
        await ProjectMember.collection.dropIndex('project_id_1_user_id_1');
      } catch(e) {}
      await ProjectMember.collection.createIndex({ project_id: 1, user_id: 1 }, { unique: true });
      console.log('Index rebuilt.');

  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

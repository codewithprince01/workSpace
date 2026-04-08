const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz')
  .then(() => console.log('Connected'))
  .catch(err => console.error(err));

const projectMemberSchema = new Schema({
  project_id: { type: Schema.Types.ObjectId, ref: 'Project' },
  user_id: { type: Schema.Types.ObjectId, ref: 'User' },
  is_favorite: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  role: String
});
// Need to match exact collection name if strictly enforced, usually 'projectmembers'
const ProjectMember = mongoose.model('ProjectMember', projectMemberSchema);

async function run() {
  try {
      console.log('Finding duplicates...');
      
      const agg = await ProjectMember.aggregate([
          {
              $group: {
                  _id: { project_id: "$project_id", user_id: "$user_id" },
                  count: { $sum: 1 },
                  docs: { $push: "$_id" }
              }
          },
          {
              $match: {
                  count: { $gt: 1 }
              }
          }
      ]);

      console.log(`Found ${agg.length} sets of duplicates.`);

      for (const group of agg) {
          console.log(`Processing group: User ${group._id.user_id} - Project ${group._id.project_id}`);
          const docIds = group.docs;
          // Keep the first one, delete the rest
          const start = docIds[0];
          const toDelete = docIds.slice(1);
          
          console.log(`Keeping ${start}, deleting ${toDelete.length} documents.`);
          await ProjectMember.deleteMany({ _id: { $in: toDelete } });
      }

      console.log('Duplicates removed. Creating unique index...');
      // Ensure index
      await ProjectMember.collection.createIndex({ project_id: 1, user_id: 1 }, { unique: true });
      console.log('Index ensured.');

  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

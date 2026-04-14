const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz')
  .then(() => console.log('Connected'))
  .catch(err => console.error(err));

async function run() {
  try {
      const ProjectCategory = mongoose.models.ProjectCategory || mongoose.model('ProjectCategory', new Schema({ name: String }));
      const Project = mongoose.models.Project || mongoose.model('Project', new Schema({ name: String, category_id: Schema.Types.ObjectId }));
      
      const cat = await ProjectCategory.findOne({});
      if (!cat) { console.log('No categories found'); return; }
      
      console.log(`Using Default Category: ${cat.name}`);

      const projects = await Project.find({});
      for (const p of projects) {
          if (!p.category_id) {
              console.log(`Fixing Project: ${p.name}`);
              p.category_id = cat._id;
              await p.save();
          } else {
              console.log(`Project ${p.name} already has category.`);
          }
      }
      console.log('All Done!');

  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

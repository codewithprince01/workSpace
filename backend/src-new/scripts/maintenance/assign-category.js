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
      console.log(`Using Category: ${cat.name} (${cat._id})`);

      const projects = await Project.find({}).limit(1);
      if (projects.length === 0) { console.log('No projects'); return; }
      
      const p = projects[0];
      console.log(`Assigning category to Project: ${p.name}`);
      
      p.category_id = cat._id;
      await p.save();
      console.log('Saved!');

  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

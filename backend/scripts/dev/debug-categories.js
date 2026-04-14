const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz')
  .then(() => console.log('Connected'))
  .catch(err => console.error(err));

async function run() {
  try {
      // Define Schemas to support population
      const ProjectCategory = mongoose.models.ProjectCategory || mongoose.model('ProjectCategory', new Schema({ name: String, color_code: String }));
      const Project = mongoose.models.Project || mongoose.model('Project', new Schema({ 
          name: String, 
          category_id: { type: Schema.Types.ObjectId, ref: 'ProjectCategory' },
          team_id: Schema.Types.ObjectId,
          is_archived: Boolean 
      }));

      console.log('--- Checking Categories ---');
      const cats = await ProjectCategory.find({});
      console.log(`Total Categories: ${cats.length}`);
      if (cats.length > 0) console.log('Sample Category:', cats[0]);

      console.log('--- Checking Projects ---');
      const projects = await Project.find({ is_archived: false }).limit(5).populate('category_id');
      
      projects.forEach(p => {
          console.log(`Project: ${p.name}`);
          console.log(` - Category ID: ${p.category_id}`);
          // If populated, category_id is an object
          if (p.category_id && p.category_id.name) {
             console.log(` - Category Name (Populated): ${p.category_id.name}`);
          } else {
             console.log(` - Category Name: NULL (Raw ID: ${p.category_id})`);
          }
      });

  } catch (e) {
      console.error(e);
  }
}

setTimeout(() => {
    run().then(() => mongoose.connection.close());
}, 1000);

require('dotenv').config();
const mongoose = require('mongoose');
const { Project } = require('./src-new/models');

async function listProjects() {
  await mongoose.connect(process.env.MONGO_URI);
  const projects = await Project.find({ name: /just/i });
  console.log('Found Projects matching "just":');
  projects.forEach(p => console.log(`- "${p.name}" (ID: ${p._id})`));
  await mongoose.disconnect();
}

listProjects();

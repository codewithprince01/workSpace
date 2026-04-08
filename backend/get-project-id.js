require('dotenv').config();
const mongoose = require('mongoose');
const { Project } = require('./src-new/models');

async function getProjectId() {
  await mongoose.connect(process.env.MONGO_URI);
  const project = await Project.findOne({ name: /prince.*saini/i });
  if (project) {
    console.log(project._id.toString());
  } else {
    console.log('NOT_FOUND');
  }
  await mongoose.disconnect();
}

getProjectId().catch(console.error);

require('dotenv').config();
const mongoose = require('mongoose');
const { Task, Project } = require('./src-new/models');

async function inspectTask() {
  await mongoose.connect(process.env.MONGO_URI);
  const project = await Project.findOne({ name: /just/i });
  const task = await Task.findOne({ project_id: project._id, name: 'frontend' });
  
  if (task) {
      console.log(JSON.stringify({
          name: task.name,
          due_date: task.due_date,
          end_date: task.end_date,
          start_date: task.start_date
      }, null, 2));
  }
  
  await mongoose.disconnect();
}

inspectTask();

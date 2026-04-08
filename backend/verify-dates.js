require('dotenv').config();
const mongoose = require('mongoose');
const { Task, Project } = require('./src-new/models');

async function verifyDates() {
  await mongoose.connect(process.env.MONGO_URI);
  const project = await Project.findOne({ name: /just/i });
  const task = await Task.findOne({ project_id: project._id, name: 'frontend' });
  
  if (task) {
    console.log(`\n🔍 Task Analysis: "${task.name}"`);
    console.log(`----------------------------------------`);
    console.log(`📅 Start Date: ${task.start_date ? task.start_date.toDateString() : 'Not Set'} (Found!)`);
    console.log(`📅 End Date:   ${task.end_date ? task.end_date.toDateString() : 'Not Set'}`);
    console.log(`📅 Due Date:   ${task.due_date ? task.due_date.toDateString() : 'Not Set'} (Required for Overdue)`);
    console.log(`----------------------------------------\n`);
    
    if (task.start_date && !task.due_date) {
      console.log('💡 DIAGNOSIS: The date "Jan 30 2026" is set as Start Date, but the Due Date is empty.');
      console.log('   Insights only looks at Due Date.');
    }
  }
  
  await mongoose.disconnect();
}

verifyDates();

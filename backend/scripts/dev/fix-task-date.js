require('dotenv').config();
const mongoose = require('mongoose');
const { Task, Project } = require('./src-new/models');

async function fixTaskDate() {
  await mongoose.connect(process.env.MONGO_URI);
  const project = await Project.findOne({ name: /just/i });
  const task = await Task.findOne({ project_id: project._id, name: 'frontend' });
  
  if (task) {
    console.log(`\n🔧 Fixing Task: "${task.name}"`);
    console.log(`   Current Start Date: ${task.start_date}`);
    console.log(`   Current Due Date: ${task.due_date}`);

    if (task.start_date) {
      task.due_date = task.start_date; // Copy start to due
      await task.save();
      console.log(`\n✅ Updated Due Date to ${task.due_date.toDateString()}`);
      console.log('   Now it should appear in Insights as Overdue!');
    } else {
      console.log('   ❌ No start date to copy!');
    }
  }
  
  await mongoose.disconnect();
}

fixTaskDate();

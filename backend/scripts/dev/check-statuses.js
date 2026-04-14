require('dotenv').config();
const mongoose = require('mongoose');
const { TaskStatus, Task } = require('./src-new/models');

async function checkStatuses() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const statuses = await TaskStatus.find({}).limit(20);
    console.log(`Found ${statuses.length} statuses:\n`);
    
    statuses.forEach(s => {
      console.log(`  "${s.name}" → category: "${s.category || 'NULL'}" (Project: ${s.project_id})`);
    });

    // Check a sample project
    if (statuses.length > 0) {
      const projectId = statuses[0].project_id;
      console.log(`\n📊 Checking tasks for project ${projectId}:\n`);
      
      const tasks = await Task.find({ project_id: projectId, is_archived: false });
      console.log(`  Total tasks: ${tasks.length}`);
      
      const doneStatuses = await TaskStatus.find({ project_id: projectId, category: 'done' });
      const todoStatuses = await TaskStatus.find({ project_id: projectId, category: 'todo' });
      
      console.log(`  Done statuses: ${doneStatuses.length}`);
      console.log(`  Todo statuses: ${todoStatuses.length}`);
      
      if (doneStatuses.length > 0) {
        const doneTasks = await Task.countDocuments({ 
          project_id: projectId, 
          status_id: { $in: doneStatuses.map(s => s._id) },
          is_archived: false
        });
        console.log(`  ✅ Tasks in "Done" status: ${doneTasks}`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkStatuses();

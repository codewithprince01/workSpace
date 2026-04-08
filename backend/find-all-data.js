require('dotenv').config();
const mongoose = require('mongoose');
const { Task, Project, TaskStatus } = require('./src-new/models');

async function findAllData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all projects
    const projects = await Project.find({ is_archived: false }).limit(10);
    console.log(`📁 Found ${projects.length} active projects:\n`);

    for (const project of projects) {
      const allTasks = await Task.find({ project_id: project._id });
      const activeTasks = await Task.find({ project_id: project._id, is_archived: false });
      const archivedTasks = await Task.find({ project_id: project._id, is_archived: true });
      
      console.log(`\n🎯 Project: "${project.name}" (ID: ${project._id})`);
      console.log(`   Total tasks: ${allTasks.length}`);
      console.log(`   Active tasks: ${activeTasks.length}`);
      console.log(`   Archived tasks: ${archivedTasks.length}`);
      
      if (activeTasks.length > 0) {
        // Get statuses
        const statuses = await TaskStatus.find({ project_id: project._id });
        const doneStatuses = statuses.filter(s => s.category === 'done');
        const todoStatuses = statuses.filter(s => s.category === 'todo');
        
        console.log(`   Statuses: ${statuses.length} (Done: ${doneStatuses.length}, Todo: ${todoStatuses.length})`);
        
        if (doneStatuses.length > 0) {
          const doneTasks = await Task.countDocuments({
            project_id: project._id,
            status_id: { $in: doneStatuses.map(s => s._id) },
            is_archived: false
          });
          console.log(`   ✅ Done tasks: ${doneTasks}`);
        }
        
        if (todoStatuses.length > 0) {
          const todoTasks = await Task.countDocuments({
            project_id: project._id,
            status_id: { $in: todoStatuses.map(s => s._id) },
            is_archived: false
          });
          console.log(`   📋 Todo tasks: ${todoTasks}`);
        }
        
        // Show sample tasks
        console.log(`\n   Sample tasks:`);
        activeTasks.slice(0, 3).forEach(t => {
          console.log(`     - "${t.name}" (Status ID: ${t.status_id}, Priority: ${t.priority})`);
        });
      }
    }

    console.log('\n\n💡 Use the Project ID shown above to test insights!');
    console.log('   Example: http://localhost:5173/projects/PROJECT_ID_HERE\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findAllData();

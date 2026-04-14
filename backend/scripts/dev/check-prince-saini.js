require('dotenv').config();
const mongoose = require('mongoose');
const { Task, Project, TaskStatus } = require('./src-new/models');

async function checkPrinceSainiProject() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find "Prince Saini" project
    const project = await Project.findOne({ name: /prince.*saini/i });
    
    if (!project) {
      console.log('❌ "Prince Saini" project not found!');
      console.log('\n📁 Available projects:');
      const allProjects = await Project.find({}).limit(10);
      allProjects.forEach(p => console.log(`  - ${p.name} (ID: ${p._id})`));
      await mongoose.disconnect();
      return;
    }

    console.log(`🎯 Found Project: "${project.name}"`);
    console.log(`   Project ID: ${project._id}\n`);

    // Get all tasks
    const allTasks = await Task.find({ project_id: project._id });
    const activeTasks = await Task.find({ project_id: project._id, is_archived: false });
    
    console.log(`📊 Task Summary:`);
    console.log(`   Total tasks: ${allTasks.length}`);
    console.log(`   Active tasks: ${activeTasks.length}`);
    console.log(`   Archived tasks: ${allTasks.length - activeTasks.length}\n`);

    if (allTasks.length === 0) {
      console.log('❌ NO TASKS FOUND IN THIS PROJECT!');
      console.log('   This is why insights shows zero.\n');
      await mongoose.disconnect();
      return;
    }

    // Get statuses
    const statuses = await TaskStatus.find({ project_id: project._id });
    console.log(`📋 Task Statuses (${statuses.length} total):`);
    statuses.forEach(s => {
      console.log(`   - "${s.name}" (category: ${s.category || 'NULL'}, color: ${s.color_code})`);
    });
    console.log('');

    // Check tasks by status
    const doneStatuses = statuses.filter(s => s.category === 'done');
    const todoStatuses = statuses.filter(s => s.category === 'todo');
    const doingStatuses = statuses.filter(s => s.category === 'doing');

    console.log(`🔍 Status Categories:`);
    console.log(`   Done statuses: ${doneStatuses.length} (${doneStatuses.map(s => s.name).join(', ')})`);
    console.log(`   Todo statuses: ${todoStatuses.length} (${todoStatuses.map(s => s.name).join(', ')})`);
    console.log(`   Doing statuses: ${doingStatuses.length} (${doingStatuses.map(s => s.name).join(', ')})\n`);

    // Count tasks by category
    if (doneStatuses.length > 0) {
      const doneTasks = await Task.countDocuments({
        project_id: project._id,
        status_id: { $in: doneStatuses.map(s => s._id) },
        is_archived: false
      });
      console.log(`   ✅ Tasks in "Done" category: ${doneTasks}`);
    }

    if (todoStatuses.length > 0) {
      const todoTasks = await Task.countDocuments({
        project_id: project._id,
        status_id: { $in: todoStatuses.map(s => s._id) },
        is_archived: false
      });
      console.log(`   📋 Tasks in "Todo" category: ${todoTasks}`);
    }

    if (doingStatuses.length > 0) {
      const doingTasks = await Task.countDocuments({
        project_id: project._id,
        status_id: { $in: doingStatuses.map(s => s._id) },
        is_archived: false
      });
      console.log(`   🔄 Tasks in "Doing" category: ${doingTasks}`);
    }

    // Show sample tasks with their status info
    console.log(`\n📝 Sample Tasks (first 5):`);
    for (const task of activeTasks.slice(0, 5)) {
      const status = await TaskStatus.findById(task.status_id);
      console.log(`   - "${task.name}"`);
      console.log(`     Status: ${status?.name || 'NO STATUS'} (category: ${status?.category || 'NULL'})`);
      console.log(`     Priority: ${task.priority}`);
      console.log(`     Archived: ${task.is_archived}`);
      console.log('');
    }

    // Check for tasks without status_id
    const tasksWithoutStatus = await Task.countDocuments({
      project_id: project._id,
      $or: [
        { status_id: null },
        { status_id: { $exists: false } }
      ]
    });

    if (tasksWithoutStatus > 0) {
      console.log(`⚠️  WARNING: ${tasksWithoutStatus} tasks have NO status_id!`);
      console.log(`   This will cause them to not appear in insights!\n`);
    }

    console.log(`\n💡 Project URL: http://localhost:5173/projects/${project._id}`);
    console.log(`💡 Debug API: http://localhost:3000/api/debug/project-data/${project._id}\n`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkPrinceSainiProject();

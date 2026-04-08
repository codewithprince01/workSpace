require('dotenv').config();
const mongoose = require('mongoose');
const { Task, Project, TaskStatus } = require('./src-new/models');

async function checkJustEducationProject() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('🕒 Server Time:', new Date().toISOString());

    // Find "Just Education JH" project
    // Using regex to match loosely
    const project = await Project.findOne({ name: /just.*education/i });
    
    if (!project) {
      console.log('❌ "Just Education" project not found!');
      console.log('Available projects:');
      const allProjects = await Project.find({}).select('name');
      allProjects.forEach(p => console.log(`- ${p.name}`));
      process.exit(0);
    }

    console.log(`\n🎯 Project: "${project.name}" (ID: ${project._id})`);
    
    // Check Statuses
    const statuses = await TaskStatus.find({ project_id: project._id });
    const doneStatuses = statuses.filter(s => s.category === 'done');
    const doneStatusIds = doneStatuses.map(s => s._id.toString());
    
    console.log(`\n📋 Statuses:`);
    statuses.forEach(s => {
      console.log(`  "${s.name}" -> Category: ${s.category}, ID: ${s._id}`);
    });

    // Check Tasks
    const tasks = await Task.find({ project_id: project._id, is_archived: false });
    console.log(`\n📊 Tasks Analysis (${tasks.length} total):`);
    
    let overdueCount = 0;
    const now = new Date();

    tasks.forEach(task => {
      const isDone = doneStatusIds.includes(task.status_id?.toString());
      const hasDueDate = !!task.due_date;
      const isOverdue = hasDueDate && new Date(task.due_date) < now;
      
      let statusName = statuses.find(s => s._id.toString() === task.status_id?.toString())?.name || 'Unknown';
      
      console.log(`  🔹 Task: "${task.name}"`);
      console.log(`     Status: "${statusName}" (Is Done category? ${isDone})`);
      console.log(`     Due Date: ${task.due_date ? new Date(task.due_date).toISOString() : 'None'}`);
      console.log(`     Is Overdue? ${isOverdue} (Server thinks: ${isOverdue && !isDone})`);
      
      if (isOverdue && !isDone) overdueCount++;
    });

    console.log(`\n✅ Calculated Overdue Count: ${overdueCount}`);
    
    // Run the actual overdue query to match controller logic
    const dbOverdueCount = await Task.countDocuments({
      project_id: project._id,
      is_archived: false,
      due_date: { $lt: now },
      status_id: { $nin: doneStatuses.map(s => s._id) }
    });
    
    console.log(`🗓️  DB Query Overdue Count: ${dbOverdueCount}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkJustEducationProject();

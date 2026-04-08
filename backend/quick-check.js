require('dotenv').config();
const mongoose = require('mongoose');
const { Task, TaskStatus } = require('./src-new/models');

const projectId = '697c74f5065ecf138368280a';

async function quickCheck() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const total = await Task.countDocuments({ project_id: projectId });
  const active = await Task.countDocuments({ project_id: projectId, is_archived: false });
  const statuses = await TaskStatus.find({ project_id: projectId });
  
  console.log('TOTAL_TASKS:', total);
  console.log('ACTIVE_TASKS:', active);
  console.log('STATUSES:', statuses.length);
  
  for (const s of statuses) {
    const count = await Task.countDocuments({ 
      project_id: projectId, 
      status_id: s._id,
      is_archived: false 
    });
    console.log(`STATUS: ${s.name} | CATEGORY: ${s.category || 'NULL'} | COUNT: ${count}`);
  }
  
  await mongoose.disconnect();
}

quickCheck().catch(console.error);

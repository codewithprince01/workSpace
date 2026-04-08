const mongoose = require('mongoose');
const Task = require('./src-new/models/Task');
const ProjectMember = require('./src-new/models/ProjectMember');
const User = require('./src-new/models/User');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'src-new/config/config.env') });

const connectDB = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('No MONGO_URI found');
  await mongoose.connect(uri);
  console.log('*** MongoDB Connected ***');
};

const run = async () => {
    try {
        await connectDB();

        // 1. Find ANY project member
        const member = await ProjectMember.findOne({ is_active: true }).populate('user_id', 'name');
        if(!member) { console.log('*** No member found ***'); return; }
        
        const projectId = member.project_id;
        const userId = member.user_id._id;
        const userName = member.user_id.name;
        
        console.log(`*** Checking Project: ${projectId}, Member: ${userName} (${userId}) ***`);
        
        // 2. Count tasks assigned to this user in this project
        // a. Using Object ID
        const countObj = await Task.countDocuments({ project_id: projectId, assignees: userId });
        console.log(`*** Count (assignees: ObjectId): ${countObj}`);
        
        // b. Using String ID
        const countStr = await Task.countDocuments({ project_id: projectId, assignees: userId.toString() });
        console.log(`*** Count (assignees: String): ${countStr}`);

        // c. Check is_archived filters
        const countActiveFalse = await Task.countDocuments({ project_id: projectId, assignees: userId, is_archived: false });
        console.log(`*** Count (is_archived: false): ${countActiveFalse}`);
    
        const countActiveNeTrue = await Task.countDocuments({ project_id: projectId, assignees: userId, is_archived: { $ne: true } });
        console.log(`*** Count (is_archived: $ne: true): ${countActiveNeTrue}`);
        
        // 3. Find *ANY* task in this project to check structure
        const anyTask = await Task.findOne({ project_id: projectId }).lean();
        if (anyTask) {
             console.log('*** Sample Task Assignees:', JSON.stringify(anyTask.assignees));
             console.log('*** Sample Task ID:', anyTask._id);
             console.log('*** Sample Task is_archived:', anyTask.is_archived);
        } else {
             console.log('*** No tasks found in project ***');
        }

        // 4. Global search for this user's tasks (ignore project)
        const globalCount = await Task.countDocuments({ assignees: userId });
        console.log(`*** Global Tasks for User: ${globalCount}`);

    } catch (error) {
        console.error('*** ERROR:', error);
    } finally {
        process.exit();
    }
};

run();

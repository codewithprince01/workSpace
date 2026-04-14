const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log(`MongoDB Connected`);
        
        const TimeLog = require('./src-new/models/TimeLog');
        
        // Update all TimeLogs to be TODAY
        const now = new Date();
        const result = await TimeLog.updateMany({}, { 
            $set: { logged_date: now } 
        });
        
        console.log(`Updated ${result.modifiedCount} TimeLogs to ${now.toISOString()}`);
        
        // Also verify task access
        const { Task, ProjectMember, User } = require('./src-new/models');
        
        // Get all logs
        const logs = await TimeLog.find({}).populate('task_id user_id');
        console.log(`Total logs: ${logs.length}`);
        
        for (const log of logs.slice(0, 5)) {
             if (!log.task_id) continue;
             const projectId = log.task_id.project_id;
             const userId = log.user_id._id;
             
             // Ensure user is member
             const exists = await ProjectMember.findOne({ project_id: projectId, user_id: userId });
             if (!exists) {
                 await ProjectMember.create({
                     project_id: projectId,
                     user_id: userId,
                     is_active: true,
                     role: 'member'
                 });
                 console.log(`+ Added ${log.user_id.name} to Project of task ${log.task_id.name}`);
             }
        }
        console.log("TimeLogs date updated and access checked.");

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        process.exit();
    }
};

connectDB();

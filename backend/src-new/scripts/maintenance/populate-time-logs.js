const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log(`MongoDB Connected`);
        
        const User = require('./src-new/models/User');
        const Task = require('./src-new/models/Task');
        const TimeLog = require('./src-new/models/TimeLog');

        const users = await User.find({}).limit(5);
        if (users.length === 0) return;

        // Find tasks with assignees
        const tasks = await Task.find({}).limit(20);
        
        console.log(`Creating time logs for ${users.length} users on ${tasks.length} tasks...`);
        let created = 0;

        for (const task of tasks) {
            // Log for assignees or random user
            const userId = task.assignees && task.assignees.length > 0 
                ? task.assignees[0] 
                : users[Math.floor(Math.random() * users.length)]._id;

            // Create 3-5 logs per task
            const numLogs = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < numLogs; i++) {
                const hours = Math.floor(Math.random() * 40) / 10 + 0.5; // 0.5 to 4.5 hours
                const daysAgo = Math.floor(Math.random() * 14); // Last 2 weeks
                
                await TimeLog.create({
                    task_id: task._id,
                    user_id: userId,
                    hours: hours,
                    description: 'Worked on task',
                    logged_date: new Date(Date.now() - daysAgo * 86400000)
                });
                created++;
            }
        }
        
        console.log(`Created ${created} Time Logs.`);

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        process.exit();
    }
};

connectDB();

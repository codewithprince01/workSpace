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
        const TaskStatus = require('./src-new/models/TaskStatus');

        // 1. Find Users
        const users = await User.find({}).limit(5);
        if (users.length === 0) {
            console.log('No users found');
            return;
        }
        console.log(`Found ${users.length} users: ${users.map(u => u.name).join(', ')}`);

        // 2. Find Tasks
        const tasks = await Task.find({}).limit(20);
        if (tasks.length === 0) {
             console.log('No tasks found');
             return;
        }

        console.log(`Found ${tasks.length} tasks. Assigning...`);

        // 3. Assign tasks
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const user = users[i % users.length]; // Round robin assignment
            
            // Get valid statuses for this project
            const statuses = await TaskStatus.find({ project_id: task.project_id });
            const todo = statuses.find(s => s.category === 'todo');
            const doing = statuses.find(s => s.category === 'doing');
            const done = statuses.find(s => s.category === 'done');

            // Random status
            let newStatusId = task.status_id;
            const rand = Math.random();
            if (rand > 0.6 && done) newStatusId = done._id;
            else if (rand > 0.3 && doing) newStatusId = doing._id;
            else if (todo) newStatusId = todo._id;

            // Update Task
            task.assignees = [user._id];
            task.status_id = newStatusId;
            // Add overdue date to some
            if (i % 3 === 0) {
                task.due_date = new Date(Date.now() - 86400000 * 5); // 5 days ago
            } else {
                task.due_date = new Date(Date.now() + 86400000 * 5); // Future
            }

            await task.save();
            console.log(`Assigned task "${task.name}" to ${user.name}`);
        }
        
        console.log("Data population complete.");

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        process.exit();
    }
};

connectDB();

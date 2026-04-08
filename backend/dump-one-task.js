const mongoose = require('mongoose');
const Task = require('./src-new/models/Task');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'src-new/config/config.env') });

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
    // Find task with assignees if possible
    const task = await Task.findOne({ 'assignees.0': { $exists: true } }).lean();
    console.log('Task with assignees:', task ? JSON.stringify(task, null, 2) : 'No task with assignees found');
    
    if(!task) {
        const anyTask = await Task.findOne().lean();
        console.log('Any Task:', anyTask ? JSON.stringify(anyTask, null, 2) : 'No tasks at all');
    }
    process.exit();
});

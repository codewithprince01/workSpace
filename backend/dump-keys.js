const mongoose = require('mongoose');
const Task = require('./src-new/models/Task');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'src-new/config/config.env') });

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
    const task = await Task.findOne().lean();
    if (task) {
        console.log('Task Keys:', Object.keys(task));
        console.log('Assignees Value:', task.assignees);
    } else {
        console.log('No tasks found');
    }
    process.exit();
});

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Check Tasks and Assignees
        const Task = require('./src-new/models/Task');
        const tasks = await Task.find({}).limit(5).select('name assignees status_id');
        console.log('Sample Tasks:', tasks.length);
        tasks.forEach(t => {
            console.log(`Task: ${t.name}, Assignees (Type: ${typeof t.assignees}, Length: ${t.assignees.length}, Content: ${JSON.stringify(t.assignees)})`);
        });

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        process.exit();
    }
};

connectDB();

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        const Task = require('./src-new/models/Task');
        // Find tasks that HAVE assignees
        const tasks = await Task.find({ assignees: { $exists: true, $not: { $size: 0 } } }).limit(5).select('name assignees project_id');
        
        console.log(`Tasks with assignees found: ${tasks.length}`);
        
        if (tasks.length > 0) {
            tasks.forEach(t => {
                console.log(`Task: ${t.name}`);
                console.log(`  Assignees: ${JSON.stringify(t.assignees)}`);
                console.log(`  First Assignee Type: ${typeof t.assignees[0]}`);
            });
            
            // Allow checking a specific user ID if needed
            // const userId = '...'; 
            // const count = await Task.countDocuments({ assignees: userId });
            // console.log(`Tasks for user ${userId}: ${count}`);
        } else {
            console.log("NO tasks have assignees.");
        }

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        process.exit();
    }
};

connectDB();

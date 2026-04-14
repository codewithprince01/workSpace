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

        // Target specific users provided by user screenshot/request
        const users = await User.find({ name: { $regex: 'Test Prins|abhi', $options: 'i' } });
        console.log(`Found ${users.length} users matching 'Test Prins' or 'abhi'.`);
        
        for (const u of users) {
             console.log(`User: ${u.name} (ID: ${u._id})`);
             const taskCount = await Task.countDocuments({ assignees: u._id });
             console.log(`  Tasks Assigned (ObjectId): ${taskCount}`);
             
             // Try string query check
             const taskCountStr = await Task.countDocuments({ assignees: u._id.toString() });
             console.log(`  Tasks Assigned (String): ${taskCountStr}`);

             if (taskCount === 0) {
                 // Force assignment of tasks
                 console.log(`  -> FORCE Assigning tasks to ${u.name}...`);
                 const tasksToAssign = await Task.find({}).limit(5); // Get 5 random tasks
                 
                 for (const t of tasksToAssign) {
                     // Avoid duplicates
                     if (!t.assignees.includes(u._id)) {
                         t.assignees.push(u._id);
                         
                         // Determine status for stats
                         // Fetch status if needed, but for now just rely on existing
                         // Ensure status_id is set
                         if (!t.status_id) {
                             // Set to a random status if possible or fail?
                             // We assume tasks have status_id.
                         }

                         await t.save();
                         console.log(`     Assigned '${t.name}' to ${u.name}`);
                     }
                 }
             }
        }

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        process.exit();
    }
};

connectDB();

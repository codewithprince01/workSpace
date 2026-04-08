const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log(`MongoDB Connected`);
        
        const TimeLog = require('./src-new/models/TimeLog');
        const Task = require('./src-new/models/Task');
        const count = await TimeLog.countDocuments({});
        console.log(`Total TimeLogs: ${count}`);

        const logs = await TimeLog.find({}).limit(5).populate('task_id');
        logs.forEach(l => {
            console.log(`Log: ${l.hours}h on ${l.logged_date} (Task: ${l.task_id?.name || 'null'})`);
        });

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        process.exit();
    }
};

connectDB();

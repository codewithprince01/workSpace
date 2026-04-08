const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('MongoDB Connected\n');
        
        const Project = require('./src-new/models/Project');
        const TimeLog = require('./src-new/models/TimeLog');
        const Task = require('./src-new/models/Task');

        // Check projects
        const allProjects = await Project.find({});
        const activeProjects = await Project.find({ is_archived: false });
        
        console.log(`Total Projects: ${allProjects.length}`);
        console.log(`Active Projects (is_archived: false): ${activeProjects.length}`);
        
        if (allProjects.length > 0) {
            console.log('\nAll Projects:');
            allProjects.forEach(p => {
                console.log(`  - ${p.name} (archived: ${p.is_archived || false})`);
            });
        }

        // Check tasks
        const tasks = await Task.find({});
        console.log(`\nTotal Tasks: ${tasks.length}`);

        // Check time logs
        const logs = await TimeLog.find({});
        console.log(`Total TimeLogs: ${logs.length}`);

        // Check if tasks belong to projects
        if (tasks.length > 0) {
            const taskWithProject = tasks.filter(t => t.project_id);
            console.log(`Tasks with project_id: ${taskWithProject.length}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
};

connectDB();

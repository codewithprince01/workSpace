const mongoose = require('mongoose');  
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const testAllocationEndpoint = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('MongoDB Connected\n');
        
        const { Task, TimeLog, Project, ProjectMember } = require('./src-new/models');
        const User = require('./src-new/models/User');

        // Get first user
        const user = await User.findOne({});
        if (!user) {
            console.log('No users found!');
            process.exit(1);
        }

        console.log(`Testing as User: ${user.name} (${user._id})\n`);

        // Simulate the getAllocationData logic
        const userId = user._id;
        const projectQuery = { is_archived: { $ne: true } };

        // Get user memberships
        const memberships = await ProjectMember.find({ user_id: userId, is_active: true });
        const allowedProjectIds = memberships.map(m => m.project_id);
        
        console.log(`User has ${memberships.length} project memberships`);
        console.log('Allowed project IDs:', allowedProjectIds.map(id => id.toString()));

        // Apply membership filter
        projectQuery._id = { $in: allowedProjectIds };

        console.log('\nProject Query:', JSON.stringify(projectQuery));

        // Find projects
        const projects = await Project.find(projectQuery)
            .select('name color_code status team_id')
            .lean();
        
        console.log(`\nFound ${projects.length} matching projects:`);
        projects.forEach(p => {
            console.log(`  - ${p.name} (ID: ${p._id})`);
        });

        if (projects.length === 0) {
            console.log('\n❌ NO PROJECTS FOUND!');
            console.log('This is why Time Reports shows no data.');
            
            // Debug: Check if projects exist at all
            const allProjects = await Project.find({});
            console.log(`\nTotal projects in DB: ${allProjects.length}`);
            
            const activeProjects = await Project.find({ is_archived: { $ne: true } });
            console.log(`Active projects in DB: ${activeProjects.length}`);
            
            if (memberships.length === 0) {
                console.log('\n⚠️  User has NO project memberships!');
                console.log('Run: node fix-project-members.js');
            }
        } else {
            // Get tasks for these projects
            const finalProjectIds = projects.map(p => p._id);
            const tasks = await Task.find({ project_id: { $in: finalProjectIds } });
            console.log(`\nFound ${tasks.length} tasks in these projects`);

            // Get time logs for these tasks
            const taskIds = tasks.map(t => t._id);
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
            
            const timeLogs = await TimeLog.find({
                task_id: { $in: taskIds },
                logged_date: { $gte: sevenDaysAgo, $lte: now }
            });

            console.log(`Found ${timeLogs.length} time logs in last 7 days`);

            if (timeLogs.length === 0) {
                console.log('\n⚠️  No time logs in last 7 days!');
                console.log('This is why Overview shows no data.');
                
                const allTimeLogs = await TimeLog.find({ task_id: { $in: taskIds } });
                console.log(`Total time logs for these tasks: ${allTimeLogs.length}`);
                
                if (allTimeLogs.length > 0) {
                    const latestLog = await TimeLog.findOne({ task_id: { $in: taskIds } }).sort({ logged_date: -1 });
                    const daysOld = Math.floor((now - new Date(latestLog.logged_date)) / 86400000);
                    console.log(`Latest log is ${daysOld} days old (${latestLog.logged_date})`);
                    console.log('\n💡 Solution: Update time logs to recent dates');
                    console.log('Run: node update-timelogs-date.js');
                }
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    } finally {
        process.exit();
    }
};

testAllocationEndpoint();

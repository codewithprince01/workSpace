const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('MongoDB Connected\n');
        
        const TimeLog = require('./src-new/models/TimeLog');
        const Task = require('./src-new/models/Task');
        const Project = require('./src-new/models/Project');
        const ProjectMember = require('./src-new/models/ProjectMember');
        const User = require('./src-new/models/User');

        // 1. Check TimeLogs
        const logCount = await TimeLog.countDocuments({});
        console.log(`✓ Total TimeLogs: ${logCount}`);
        
        if (logCount > 0) {
            const recentLogs = await TimeLog.find({}).sort({ logged_date: -1 }).limit(3).populate('task_id user_id');
            console.log('\nRecent TimeLogs:');
            recentLogs.forEach(log => {
                const daysAgo = Math.floor((Date.now() - new Date(log.logged_date).getTime()) / 86400000);
                console.log(`  - ${log.hours}h by ${log.user_id?.name || 'Unknown'} on ${log.task_id?.name || 'Unknown Task'} (${daysAgo} days ago)`);
            });
        }

        // 2. Check Users
        const users = await User.find({}).limit(5);
        console.log(`\n✓ Sample Users (${users.length}):`);
        users.forEach(u => console.log(`  - ${u.name} (${u.email})`));

        // 3. Check Projects
        const projects = await Project.find({ is_archived: false }).limit(5);
        console.log(`\n✓ Active Projects (${projects.length}):`);
        projects.forEach(p => console.log(`  - ${p.name}`));

        // 4. Check Project Memberships for first user
        if (users.length > 0) {
            const userId = users[0]._id;
            const memberships = await ProjectMember.find({ user_id: userId, is_active: true });
            console.log(`\n✓ User "${users[0].name}" is member of ${memberships.length} projects`);
            
            if (memberships.length === 0) {
                console.log('  ⚠️  WARNING: User has NO project memberships!');
                console.log('  → This will cause empty results in Time Reports (Overview)');
            }
        }

        // 5. Check Tasks
        const taskCount = await Task.countDocuments({});
        console.log(`\n✓ Total Tasks: ${taskCount}`);

        // 6. Check Task-Log-Project relationships
        const logsWithDetails = await TimeLog.find({}).limit(5).populate({
            path: 'task_id',
            populate: { path: 'project_id' }
        }).populate('user_id');

        console.log('\n✓ TimeLog → Task → Project chain (sample):');
        logsWithDetails.forEach(log => {
            if (log.task_id && log.task_id.project_id) {
                const projectName = log.task_id.project_id.name || 'Unknown Project';
                const taskName = log.task_id.name || 'Unknown Task';
                const userName = log.user_id?.name || 'Unknown User';
                console.log(`  - ${userName} logged ${log.hours}h on "${taskName}" in "${projectName}"`);
            }
        });

        // 7. Diagnostic Summary
        console.log('\n' + '='.repeat(60));
        console.log('DIAGNOSTIC SUMMARY');
        console.log('='.repeat(60));

        const issues = [];
        
        if (logCount === 0) {
            issues.push('❌ NO TimeLogs exist - Time Reports will be empty');
        } else {
            const oldestLog = await TimeLog.findOne({}).sort({ logged_date: 1 });
            const newestLog = await TimeLog.findOne({}).sort({ logged_date: -1 });
            const oldestDate = new Date(oldestLog.logged_date);
            const newestDate = new Date(newestLog.logged_date);
            const daysOld = Math.floor((Date.now() - newestDate.getTime()) / 86400000);
            
            console.log(`TimeLog date range: ${oldestDate.toDateString()} to ${newestDate.toDateString()}`);
            
            if (daysOld > 7) {
                issues.push(`⚠️  Newest TimeLog is ${daysOld} days old - May not show in "Last 7 Days" filter`);
            }
        }

        if (users.length > 0) {
            const memberships = await ProjectMember.find({ user_id: users[0]._id, is_active: true });
            if (memberships.length === 0) {
                issues.push('⚠️  Sample user has NO project memberships - RLS will filter out all data');
            }
        }

        if (issues.length === 0) {
            console.log('✅ All checks passed! Data looks good.');
        } else {
            console.log('\n⚠️  ISSUES FOUND:');
            issues.forEach(issue => console.log(`  ${issue}`));
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
};

connectDB();

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('MongoDB Connected\n');
        
        const Project = require('./src-new/models/Project');
        const ProjectMember = require('./src-new/models/ProjectMember');
        const User = require('./src-new/models/User');

        // Get all projects with team info
        const projects = await Project.find({}).select('name team_id is_archived');
        console.log('All Projects:');
        projects.forEach(p => {
            console.log(`  - ${p.name}`);
            console.log(`    team_id: ${p.team_id}`);
            console.log(`    is_archived: ${p.is_archived}`);
        });

        // Get first user and their memberships
        const users = await User.find({}).limit(1);
        if (users.length > 0) {
            const user = users[0];
            console.log(`\nUser: ${user.name} (${user._id})`);
            
            const memberships = await ProjectMember.find({ user_id: user._id, is_active: true })
                .populate('project_id', 'name team_id');
            
            console.log(`\nUser's Project Memberships (${memberships.length}):`);
            memberships.forEach(m => {
                if (m.project_id) {
                    console.log(`  - ${m.project_id.name}`);
                    console.log(`    project_id: ${m.project_id._id}`);
                    console.log(`    team_id: ${m.project_id.team_id}`);
                }
            });
        }

        // Check what team IDs the frontend is sending (from logs)
        const frontendTeamIds = ['69736378346d3f3698614945', '697363d5346d3f369861494f'];
        console.log('\n Frontend is filtering by team_ids:', frontendTeamIds);
        
        const matchingProjects = await Project.find({ 
            team_id: { $in: frontendTeamIds },
            is_archived: { $ne: true }
        });
        console.log(`Projects matching frontend team filters: ${matchingProjects.length}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
};

connectDB();

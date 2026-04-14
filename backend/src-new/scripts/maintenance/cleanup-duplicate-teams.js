const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cleanupDuplicateTeams = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('MongoDB Connected');

        const Team = require('./src-new/models/Team');
        const TeamMember = require('./src-new/models/TeamMember');
        const Project = require('./src-new/models/Project');

        // Find all teams
        const teams = await Team.find({});
        console.log(`\nTotal teams: ${teams.length}`);
        
        teams.forEach((team, index) => {
            console.log(`\n${index + 1}. Team: ${team.name}`);
            console.log(`   ID: ${team._id}`);
            console.log(`   Owner: ${team.owner_id}`);
        });

        // Check which teams have projects
        for (const team of teams) {
            const projectCount = await Project.countDocuments({ team_id: team._id });
            console.log(`\n${team.name} has ${projectCount} projects`);
        }

        // Find teams with pattern "...'s Team" (default created teams)
        const defaultTeams = teams.filter(t => t.name.includes("'s Team"));
        console.log(`\n\nDefault teams found: ${defaultTeams.length}`);
        
        if (defaultTeams.length > 0) {
            console.log('\n⚠️  Deleting default auto-created teams...');
            
            for (const team of defaultTeams) {
                const projectCount = await Project.countDocuments({ team_id: team._id });
                
                if (projectCount === 0) {
                    console.log(`\n✅ Deleting "${team.name}" (no projects)...`);
                    await TeamMember.deleteMany({ team_id: team._id });
                    await Team.findByIdAndDelete(team._id);
                    console.log('   Deleted successfully!');
                } else {
                    console.log(`\n⚠️  Keeping "${team.name}" (has ${projectCount} projects)`);
                }
            }
        }

        console.log('\n\n✅ Cleanup complete!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
};

cleanupDuplicateTeams();

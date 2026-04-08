const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const checkSpecificProjects = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('MongoDB Connected\n');
        
        const Project = require('./src-new/models/Project');

        // Check the 2 specific project IDs from the logs
        const projectIds = [
            '697c74f5065ecf138368280a',
            '697c85aa83b4bf59a0b0edd2'
        ];

        console.log('Checking specific projects from query:\n');
        
        for (const id of projectIds) {
            const project = await Project.findById(id);
            if (project) {
                console.log(`Project: ${project.name}`);
                console.log(`  _id: ${project._id}`);
                console.log(`  is_archived: ${project.is_archived} (type: ${typeof project.is_archived})`);
                console.log(`  category_id: ${project.category_id}`);
                console.log(`  team_id: ${project.team_id}`);
                console.log('');
            } else {
                console.log(`Project ${id} NOT FOUND!\n`);
            }
        }

        // Check how many projects match the exact query from logs
        console.log('Testing query from logs:\n');
        
        // Old query (what the logs showed)
        const oldQuery = {
            is_archived: false,
            category_id: { $in: ['69737609be84858730cf1e74'] },
            _id: { $in: projectIds }
        };
        const oldResults = await Project.find(oldQuery);
        console.log(`Old query (is_archived: false): ${oldResults.length} projects`);

        // New query (what it should be)
        const newQuery = {
            is_archived: { $ne: true },
            category_id: { $in: ['69737609be84858730cf1e74'] },
            _id: { $in: projectIds }
        };
        const newResults = await Project.find(newQuery);
        console.log(`New query (is_archived: {$ne: true}): ${newResults.length} projects`);

        if (newResults.length > 0) {
            console.log('\n✅ Projects found with new query:');
            newResults.forEach(p => console.log(`  - ${p.name}`));
        }

        // Check all projects to see is_archived values
        console.log('\nAll projects is_archived status:');
        const allProjects = await Project.find({});
        allProjects.forEach(p => {
            console.log(`  - ${p.name}: is_archived = ${p.is_archived} (${typeof p.is_archived})`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
};

checkSpecificProjects();

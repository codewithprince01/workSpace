const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log(`MongoDB Connected`);
        
        const User = require('./src-new/models/User');
        const Project = require('./src-new/models/Project');
        const ProjectMember = require('./src-new/models/ProjectMember');

        const users = await User.find({}).limit(10);
        const projects = await Project.find({}).limit(10);

        if (users.length === 0 || projects.length === 0) {
            console.log('No users or projects found.');
            return;
        }

        console.log(`Ensuring ${users.length} users are members of ${projects.length} projects...`);

        for (const p of projects) {
            for (const u of users) {
                const query = { project_id: p._id, user_id: u._id };
                const exists = await ProjectMember.findOne(query);
                if (!exists) {
                    await ProjectMember.create({
                        ...query,
                        is_active: true,
                        role: 'member' // or proper role
                    });
                    console.log(`Added ${u.name} to Project ${p.name}`);
                }
            }
        }
        
        console.log("Project Memberships fixed.");

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        process.exit();
    }
};

connectDB();

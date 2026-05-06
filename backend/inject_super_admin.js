require('dotenv').config();
const mongoose = require('mongoose');
const { User, Team, TeamMember, Project, ProjectMember } = require('./src-new/models');

const injectAdmin = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const email = 'amanahlawat1918@gmail.com';
        const password = 'Aman@12345';

        let user = await User.findOne({ email });
        if (user) {
            console.log('User already exists, updating...');
            user.role = 'super_admin';
            user.is_admin = true;
            user.is_owner = true;
            user.password = password;
            user.is_active = true;
            user.setup_completed = true;
            await user.save();
        } else {
            console.log('Creating new super_admin user...');
            user = new User({
                name: 'Aman Super Admin',
                email: email,
                password: password,
                role: 'super_admin',
                is_admin: true,
                is_owner: true,
                is_active: true,
                setup_completed: true
            });
            await user.save();
        }

        // Ensure user has a team
        let team = await Team.findOne({ owner_id: user._id });
        if (!team) {
            console.log('Creating default team for super admin...');
            team = new Team({
                name: 'Aman Workspace',
                owner_id: user._id
            });
            await team.save();
        }

        // Add user as owner in TeamMember
        let membership = await TeamMember.findOne({ team_id: team._id, user_id: user._id });
        if (!membership) {
            console.log('Creating team membership...');
            membership = new TeamMember({
                team_id: team._id,
                user_id: user._id,
                role: 'owner',
                is_active: true
            });
            await membership.save();
        }

        // Ensure user has a project
        let project = await Project.findOne({ team_id: team._id, owner_id: user._id });
        if (!project) {
            console.log('Creating sample project for super admin...');
            project = new Project({
                name: 'Worklenz Main Project',
                key: 'WLZ',
                team_id: team._id,
                owner_id: user._id,
                status: 'active'
            });
            await project.save();
        }

        // Ensure project has default statuses
        const TaskStatus = mongoose.model('TaskStatus');
        const existingStatuses = await TaskStatus.find({ project_id: project._id });
        if (existingStatuses.length === 0) {
            console.log('Creating default task statuses for project...');
            const defaultStatuses = [
                { name: 'To Do', category: 'todo', color_code: '#75c9c0', sort_order: 0, is_default: true },
                { name: 'In Progress', category: 'doing', color_code: '#3b7ad4', sort_order: 1 },
                { name: 'Done', category: 'done', color_code: '#70a6f3', sort_order: 2 }
            ];

            for (const statusObj of defaultStatuses) {
                await TaskStatus.create({
                    ...statusObj,
                    project_id: project._id
                });
            }
        }

        // Add user as member in ProjectMember
        let projectMembership = await ProjectMember.findOne({ project_id: project._id, user_id: user._id });
        if (!projectMembership) {
            console.log('Creating project membership...');
            projectMembership = new ProjectMember({
                project_id: project._id,
                user_id: user._id,
                team_member_id: membership._id,
                role: 'owner',
                is_active: true
            });
            await projectMembership.save();
        }

        // Update user's last_team_id for immediate context
        user.last_team_id = team._id;
        await user.save();

        console.log('Super Admin, Workspace, and Project setup completed successfully');
    } catch (err) {
        console.error('Error during setup:', err);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
};

injectAdmin();

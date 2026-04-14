const mongoose = require('mongoose');
const { User, Team, TeamMember } = require('./src-new/models');
require('dotenv').config();

const email = 'hehe@gmail.com'; // Using the email seen in logs

async function fixUserRole() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/worklenz');
    console.log('Connected to DB');

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User ${email} not found!`);
      return;
    }

    console.log('Current User Status:', {
      id: user._id,
      name: user.name,
      email: user.email,
      is_admin: user.is_admin,
      is_owner: user.is_owner
    });

    // 1. Make User an Admin & Owner
    user.is_admin = true;
    user.is_owner = true;
    await user.save();
    console.log('✅ Updated User to Admin/Owner');

    // 2. Ensure they have a Team and are Owner of it
    let team = await Team.findOne({ owner_id: user._id });
    if (!team) {
      // Create a team if none exists
      team = await Team.create({
        name: `${user.name}'s Team`,
        owner_id: user._id,
        color_code: '#1890ff'
      });
      console.log('✅ Created new Team for user');
    } else {
      console.log('User already owns a team:', team.name);
    }

    // 3. Ensure they are a member of that team with 'owner' role
    let member = await TeamMember.findOne({ team_id: team._id, user_id: user._id });
    if (!member) {
      await TeamMember.create({
        team_id: team._id,
        user_id: user._id,
        role: 'owner',
        is_active: true
      });
      console.log('✅ Added user to TeamMember as owner');
    } else if (member.role !== 'owner') {
      member.role = 'owner';
      await member.save();
      console.log('✅ Updated TeamMember role to owner');
    }

    console.log('All done! You should now see Admin Center.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixUserRole();

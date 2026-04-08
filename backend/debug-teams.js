const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const { User, Team, TeamMember } = require('./src-new/models');

const fs = require('fs');

const checkTeams = async () => {
  let output = '';
  const log = (msg) => { console.log(msg); output += msg + '\n'; };

  try {
    await mongoose.connect(process.env.MONGO_URI);
    log('Connected to DB');

    // Search for specific teams or users
    const teamNames = ['WebVertex', "harshit's Team"];
    
    // Find these teams
    const specificTeams = await Team.find({ name: { $in: teamNames } });
    log(`\n--- Found ${specificTeams.length} specific teams ---`);
    for (const t of specificTeams) {
        log(`Team: "${t.name}" (ID: ${t._id}) Owner: ${t.owner_id}`);
        // Find members
        const members = await TeamMember.find({ team_id: t._id }).populate('user_id');
        members.forEach(m => {
             log(`  - Member: ${m.user_id ? m.user_id.name : 'Unknown'} (${m.user_id ? m.user_id.email : 'No Email'}) Role: ${m.role}`);
        });
    }

    // Also search user 'harshit'
    const harshitUser = await User.findOne({ name: { $regex: 'harshit', $options: 'i' } });
    if (harshitUser) {
         log(`\n--- User Found: ${harshitUser.name} ---`);
         const memberships = await TeamMember.find({ user_id: harshitUser._id }).populate('team_id');
         memberships.forEach(m => {
            log(`  - Member of: "${m.team_id ? m.team_id.name : 'Unknown'}" Role: ${m.role}`);
         });
    }

    fs.writeFileSync('teams_debug.txt', output);
    log('Output written to teams_debug.txt');

  } catch (err) {
    log('Error: ' + err.message);
  } finally {
    await mongoose.disconnect();
  }
};

checkTeams();

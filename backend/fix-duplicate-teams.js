const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const { User, Team, TeamMember } = require('./src-new/models');

const fixTeams = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // Find the unwanted team
    const teamName = "harshit's Team";
    const userEmail = "harshit@gmail.com";
    
    const user = await User.findOne({ email: userEmail });
    if (!user) {
        console.log("User not found");
        return;
    }

    const team = await Team.findOne({ name: teamName, owner_id: user._id });
    if (!team) {
        console.log("Team not found or already deleted");
        return;
    }

    console.log(`Found team to delete: ${team.name} (${team._id})`);

    // Verify it doesn't have other members (safety check)
    const members = await TeamMember.find({ team_id: team._id });
    if (members.length > 1) {
        console.log("WARNING: Team has multiple members. Aborting auto-delete for safety.");
        members.forEach(m => console.log(` - Member: ${m.user_id}`));
        return;
    }

    // Delete memberships first
    await TeamMember.deleteMany({ team_id: team._id });
    console.log("Deleted team memberships");

    // Delete team
    await Team.deleteOne({ _id: team._id });
    console.log("Deleted team successfully");

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

fixTeams();

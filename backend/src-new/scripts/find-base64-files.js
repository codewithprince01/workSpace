const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const findBase64Files = async () => {
    const { TaskAttachment, User, Team } = require('../models');

    console.log('\n--- Checking TaskAttachments ---');
    const attachments = await TaskAttachment.find({ url: { $regex: /^data:/ } });
    console.log(`Found ${attachments.length} attachments with base64 URLs`);
    attachments.forEach(a => console.log(`- ID: ${a._id}, Name: ${a.file_name}, Size: ${a.url.length} chars`));

    console.log('\n--- Checking Users (Avatars) ---');
    const users = await User.find({ avatar_url: { $regex: /^data:/ } });
    console.log(`Found ${users.length} users with base64 avatars`);
    users.forEach(u => console.log(`- ID: ${u._id}, Name: ${u.name}, Size: ${u.avatar_url.length} chars`));

    console.log('\n--- Checking Teams (Logos) ---');
    const teams = await Team.find({ logo_url: { $regex: /^data:/ } });
    console.log(`Found ${teams.length} teams with base64 logos`);
    teams.forEach(t => console.log(`- ID: ${t._id}, Name: ${t.name}, Size: ${t.logo_url.length} chars`));

    mongoose.connection.close();
};

const run = async () => {
    await connectDB();
    await findBase64Files();
};

run();

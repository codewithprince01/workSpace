const mongoose = require('mongoose');
require('dotenv').config();

const diagnose = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const testId = '698af5564bf568713c038fe6';
        console.log(`🔍 Diagnosing ID: ${testId}`);

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const TeamMember = mongoose.model('TeamMember', new mongoose.Schema({}, { strict: false }));
        const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }));

        const user = await User.findById(testId);
        console.log('👤 Found as User:', user ? 'YES' : 'NO');
        if (user) console.log('   Name:', user.name, 'Email:', user.email);

        const tm = await TeamMember.findById(testId);
        console.log('👥 Found as TeamMember:', tm ? 'YES' : 'NO');

        const project = await Project.findById(testId);
        console.log('📂 Found as Project:', project ? 'YES' : 'NO');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

diagnose();

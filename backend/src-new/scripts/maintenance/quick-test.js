const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const quickTest = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        
        const Project = require('./src-new/models/Project');

        const projectIds = ['697c74f5065ecf138368280a', '697c85aa83b4bf59a0b0edd2'];

        // Test1: Just the 2 IDs
        const r1 = await Project.find({ _id: { $in: projectIds } });
        console.log(`Test 1 - Just IDs: ${r1.length} projects`);

        // Test 2: IDs + is_archived false
        const r2 = await Project.find({ _id: { $in: projectIds }, is_archived: false });
        console.log(`Test 2 - IDs + is_archived=false: ${r2.length} projects`);

        // Test 3: IDs + is_archived $ne true
        const r3 = await Project.find({ _id: { $in: projectIds }, is_archived: { $ne: true } });
        console.log(`Test 3 - IDs + is_archived $ne true: ${r3.length} projects`);

        // Test 4: Full query from logs  
        const r4 = await Project.find({
            _id: { $in: projectIds },
            is_archived: { $ne: true },
            category_id: { $in: ['69737609be84858730cf1e74'] }
        });
        console.log(`Test 4 - Full new query: ${r4.length} projects`);

        if (r4.length > 0) {
            console.log('\n✅ SUCCESS! Projects found:');
            r4.forEach(p => console.log(`  - ${p.name}`));
        } else {
            console.log('\n❌ PROBLEM: Full query returns 0');
            console.log('Checking why...\n');
            
            // Check category
            r1.forEach(p => {
                console.log(`Project: ${p.name}`);
                console.log(`  has category_id: ${p.category_id}`);
                console.log(`  matches filter? ${p.category_id?.toString() === '69737609be84858730cf1e74'}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
};

quickTest();

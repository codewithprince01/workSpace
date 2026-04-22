const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs-extra');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const storageService = require('../services/storage.service');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    }
};

const migrateBase64ToFiles = async () => {
    const { TaskAttachment } = require('../models');

    console.log('🔍 Searching for Base64 attachments...');
    const attachments = await TaskAttachment.find({ url: { $regex: /^data:/ } });
    console.log(`📝 Found ${attachments.length} attachments to migrate.`);

    for (const attachment of attachments) {
        console.log(`\n📦 Migrating: ${attachment.file_name} (${attachment._id})`);
        
        try {
            const ext = attachment.file_name.split('.').pop() || 'bin';
            const key = `task-attachments/${attachment.task_id || 'general'}/${Date.now()}-${attachment.file_name.replace(/\s+/g, '-')}`;
            
            // This will decode base64, save to disk, and return proper URL
            const newUrl = await storageService.uploadBase64(
                key,
                attachment.url,
                attachment.file_name,
                attachment.user_id || null
            );
            
            // Update the record
            await TaskAttachment.findByIdAndUpdate(attachment._id, {
                url: newUrl,
                file_key: key
            });
            
            console.log(`✅ Success! New URL: ${newUrl}`);
        } catch (error) {
            console.error(`❌ Failed to migrate ${attachment._id}:`, error.message);
        }
    }

    console.log('\n✨ Migration complete!');
    mongoose.connection.close();
};

const run = async () => {
    await connectDB();
    await migrateBase64ToFiles();
};

run();

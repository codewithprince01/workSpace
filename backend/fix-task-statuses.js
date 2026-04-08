require('dotenv').config();
const mongoose = require('mongoose');
const { TaskStatus } = require('./src-new/models');

// Script to fix task status categories for existing projects
async function fixTaskStatusCategories() {
  try {
    console.log('🔧 Starting Task Status Category Fix...\n');

    // Connect to MongoDB using the same URI as the main app
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found in environment variables!');
      process.exit(1);
    }
    
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all task statuses
    const allStatuses = await TaskStatus.find({});
    console.log(`📊 Found ${allStatuses.length} task statuses\n`);

    let updatedCount = 0;

    // Update statuses based on their names
    for (const status of allStatuses) {
      const nameLower = status.name.toLowerCase();
      let category = null;

      // Determine category based on common status names
      if (nameLower.includes('to do') || 
          nameLower.includes('todo') || 
          nameLower.includes('backlog') ||
          nameLower.includes('open') ||
          nameLower.includes('new')) {
        category = 'todo';
      } 
      else if (nameLower.includes('done') || 
               nameLower.includes('complete') || 
               nameLower.includes('closed') ||
               nameLower.includes('finished')) {
        category = 'done';
      } 
      else if (nameLower.includes('progress') || 
               nameLower.includes('doing') || 
               nameLower.includes('working') ||
               nameLower.includes('development') ||
               nameLower.includes('testing') ||
               nameLower.includes('review')) {
        category = 'doing';
      }
      else {
        // Default to 'doing' for unknown statuses
        category = 'doing';
      }

      // Update if category is different or missing
      if (status.category !== category) {
        status.category = category;
        await status.save();
        updatedCount++;
        console.log(`✓ Updated "${status.name}" → category: "${category}"`);
      }
    }

    console.log(`\n✅ Migration Complete!`);
    console.log(`📝 Updated ${updatedCount} task statuses`);
    console.log(`\n🎉 All task statuses now have proper categories!`);
    console.log(`\n💡 Now refresh your Insights page to see the data!\n`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the migration
fixTaskStatusCategories();

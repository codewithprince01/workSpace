/**
 * WORKLENZ DATA REPAIR SCRIPT
 * This script ensures every project has default task statuses (To Do, In Progress, Done).
 * Use this to fix the "No task groups found" issue on live environments.
 * 
 * Usage: node repair_data.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

// In your .env, the variable is MONGO_URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz_db';

// Atlas connection options matching your src-new/config/db.js
const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 60000,
  family: 4,
  maxPoolSize: 10,
};

// Models (Minimal required)
const TaskStatusSchema = new mongoose.Schema({
  name: String,
  project_id: mongoose.Schema.Types.ObjectId,
  category: String,
  color_code: String,
  sort_order: Number,
  is_default: Boolean
});
const TaskStatus = mongoose.model('TaskStatus', TaskStatusSchema, 'taskstatuses');

const ProjectSchema = new mongoose.Schema({
  name: String
});
const Project = mongoose.model('Project', ProjectSchema, 'projects');

async function repair() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    // Log masked URI for debugging
    const maskedUri = MONGO_URI.replace(/:[^:@]+@/, ':****@');
    console.log(`URI: ${maskedUri}`);

    await mongoose.connect(MONGO_URI, MONGO_OPTIONS);
    console.log('✅ Connected.');

    const projects = await Project.find({});
    console.log(`🔍 Found ${projects.length} projects. Checking statuses...`);

    let healedCount = 0;

    for (const project of projects) {
      const statuses = await TaskStatus.find({ project_id: project._id });
      
      if (statuses.length === 0) {
        console.log(`⚠️ Project "${project.name}" (${project._id}) is missing statuses. Healing...`);
        
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
        
        healedCount++;
      }
    }

    console.log('=========================================');
    console.log(`🏁 Repair Finished.`);
    console.log(`✨ Total Projects Healed: ${healedCount}`);
    console.log('=========================================');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during repair:', error);
    process.exit(1);
  }
}

repair();

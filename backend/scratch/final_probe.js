const mongoose = require('mongoose');
const fs = require('fs');

async function run() {
  try {
    // Manually connect using Mongoose
    // Load config manually if possible or just assume standard
    require('dotenv').config();
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/worklenz';
    await mongoose.connect(uri);
    console.log('Connected to DB');

    const Task = mongoose.model('Task', new mongoose.Schema({ labels: [mongoose.Schema.Types.Mixed] }, { strict: false }));
    const task = await Task.findOne({ labels: { $exists: true, $not: { $size: 0 } } });

    if (task) {
      console.log('Task Labels:', JSON.stringify(task.labels, null, 2));
      console.log('Type check:', typeof task.labels[0]);
      if (task.labels[0] instanceof mongoose.Types.ObjectId) {
        console.log('Is ObjectId');
      } else {
        console.log('Is NOT ObjectId');
      }
    } else {
      console.log('No labels found in any task');
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();

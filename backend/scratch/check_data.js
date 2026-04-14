const mongoose = require('mongoose');
const { Task } = require('../src-new/models');

async function check() {
  try {
    const task = await Task.findOne({ labels: { $exists: true, $not: { $size: 0 } } });
    if (!task) {
        console.log('No tasks with labels found');
    } else {
        console.log('Task ID:', task._id);
        console.log('Labels Value:', JSON.stringify(task.labels, null, 2));
        console.log('Labels Type[0]:', typeof task.labels[0]);
        console.log('Is ObjectId:', task.labels[0] instanceof mongoose.Types.ObjectId);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();

const TaskDependency = require('../models/TaskDependency');
const Task = require('../models/Task');

exports.getTaskDependencies = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const dependencies = await TaskDependency.find({ task_id: taskId })
      .populate('related_task_id', 'name task_key');

    // Format for frontend
    const formatted = dependencies.map(dep => ({
      id: dep._id,
      dependency_type: dep.dependency_type,
      task_id: dep.task_id,
      related_task_id: dep.related_task_id ? dep.related_task_id._id : null,
      task_name: dep.related_task_id ? dep.related_task_id.name : 'Unknown',
      task_key: dep.related_task_id ? dep.related_task_id.task_key : ''
    }));

    res.json({ done: true, body: formatted });
  } catch (error) {
    next(error);
  }
};

exports.createTaskDependency = async (req, res, next) => {
  try {
    const { task_id, related_task_id, dependency_type } = req.body;
    
    // Check if task and related task exist
    const task = await Task.findById(task_id);
    const relatedTask = await Task.findById(related_task_id);
    
    if (!task || !relatedTask) {
      return res.status(404).json({ done: false, message: 'Task not found' });
    }

    const dependency = new TaskDependency({
      task_id,
      related_task_id,
      dependency_type: dependency_type || 'blocked_by'
    });

    await dependency.save();

    res.json({ done: true, body: dependency });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ done: false, message: 'Dependency already exists' });
    }
    next(error);
  }
};

exports.deleteTaskDependency = async (req, res, next) => {
  try {
    const { id } = req.params;
    await TaskDependency.findByIdAndDelete(id);
    res.json({ done: true });
  } catch (error) {
    next(error);
  }
};

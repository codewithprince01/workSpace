const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { Task, TaskStatus, Project } = require('../models');

router.use(protect);

// GET /api/debug/project-data/:projectId
router.get('/project-data/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get project
    const project = await Project.findById(projectId);
    
    // Get all tasks
    const allTasks = await Task.find({ project_id: projectId });
    const activeTasks = await Task.find({ project_id: projectId, is_archived: false });
    
    // Get all statuses
    const statuses = await TaskStatus.find({ project_id: projectId });
    
    // Get tasks by status
    const tasksByStatus = {};
    for (const status of statuses) {
      const count = await Task.countDocuments({ 
        project_id: projectId, 
        status_id: status._id,
        is_archived: false 
      });
      tasksByStatus[status.name] = {
        count,
        category: status.category,
        color: status.color_code
      };
    }

    // Get tasks by priority
    const tasksByPriority = {};
    const priorities = ['low', 'medium', 'high', 'urgent'];
    for (const priority of priorities) {
      const count = await Task.countDocuments({ 
        project_id: projectId, 
        priority,
        is_archived: false 
      });
      tasksByPriority[priority] = count;
    }

    res.json({
      done: true,
      body: {
        project: {
          id: project?._id,
          name: project?.name
        },
        summary: {
          total_tasks: allTasks.length,
          active_tasks: activeTasks.length,
          archived_tasks: allTasks.length - activeTasks.length,
          total_statuses: statuses.length
        },
        statuses: statuses.map(s => ({
          id: s._id,
          name: s.name,
          category: s.category,
          color: s.color_code,
          is_default: s.is_default
        })),
        tasks_by_status: tasksByStatus,
        tasks_by_priority: tasksByPriority,
        sample_tasks: activeTasks.slice(0, 5).map(t => ({
          id: t._id,
          name: t.name,
          status_id: t.status_id,
          priority: t.priority,
          is_archived: t.is_archived
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      done: false,
      message: error.message
    });
  }
});

// GET /api/debug/test-email?to=email@example.com
router.get('/test-email', async (req, res) => {
  try {
    const { to } = req.query;
    if (!to) return res.status(400).json({ success: false, message: 'Recipient email (?to=...) is required' });

    const emailService = require('../services/email.service');
    const result = await emailService.sendEmail({
      to,
      subject: 'Worklenz SMTP Test',
      html: `
        <h1>SMTP Test Successful</h1>
        <p>This email confirms that your SMTP settings for <strong>Britannica Overseas</strong> are working correctly.</p>
        <p>Timestamp: ${new Date().toLocaleString()}</p>
      `
    });

    if (result.success) {
      res.json({ success: true, message: `Test email sent successfully to ${to}`, messageId: result.messageId });
    } else {
      res.status(500).json({ success: false, message: 'Email failed to send', error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

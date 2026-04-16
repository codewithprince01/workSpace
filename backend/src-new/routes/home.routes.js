const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Apply protection to all routes
router.use(protect);

// POST /api/home/personal-task - Create personal task
router.post('/personal-task', async (req, res) => {
  try {
    const { PersonalTask } = require('../models');
    // Frontend sends 'name' in the body, not 'task'
    const { task, name } = req.body;
    const taskName = name || task;
    
    if (!taskName) {
      return res.status(400).json({ done: false, message: 'Task name is required' });
    }

    const newTask = await PersonalTask.create({
      user_id: req.user._id,
      name: taskName,
      is_completed: false
    });

    res.json({
      done: true,
      body: {
        id: newTask._id,
        name: newTask.name,
        is_completed: newTask.is_completed
      }
    });
  } catch (error) {
    console.error('Create personal task error:', error);
    res.status(500).json({ done: false, message: 'Failed to create personal task' });
  }
});

// PUT /api/home/update-personal-task - Mark personal task as done (Frontend specific route)
router.put('/update-personal-task', async (req, res) => {
  try {
    const { PersonalTask } = require('../models');
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ done: false, message: 'Task ID is required' });
    }
    
    const task = await PersonalTask.findOne({ _id: id, user_id: req.user._id });
    
    if (!task) {
      return res.status(404).json({ done: false, message: 'Task not found' });
    }
    
    task.is_completed = !task.is_completed;
    await task.save();

    res.json({
      done: true,
      body: {
        id: task._id,
        name: task.name,
        is_completed: task.is_completed
      }
    });
  } catch (error) {
    console.error('Update personal task error:', error);
    res.status(500).json({ done: false, message: 'Failed to update task' });
  }
});

// GET /api/home/personal-tasks - Get personal tasks
router.get('/personal-tasks', async (req, res) => {
  try {
    const { PersonalTask } = require('../models');
    
    const tasks = await PersonalTask.find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .limit(50); // Limit to 50 recent tasks

    res.json({
      done: true,
      body: tasks.map(t => ({
        id: t._id,
        name: t.name,
        is_completed: t.is_completed
      }))
    });
  } catch (error) {
    console.error('Fetch personal tasks error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch personal tasks' });
  }
});

// PUT /api/home/personal-task/:id - Update personal task (mark as complete)
router.put('/personal-task/:id', async (req, res) => {
  try {
    const { PersonalTask } = require('../models');
    const { is_completed, name } = req.body;
    
    const task = await PersonalTask.findOne({ _id: req.params.id, user_id: req.user._id });
    
    if (!task) {
      return res.status(404).json({ done: false, message: 'Task not found' });
    }
    
    if (is_completed !== undefined) task.is_completed = is_completed;
    if (name) task.name = name;
    
    await task.save();

    res.json({
      done: true,
      body: {
        id: task._id,
        name: task.name,
        is_completed: task.is_completed
      }
    });
  } catch (error) {
    console.error('Update personal task error:', error);
    res.status(500).json({ done: false, message: 'Failed to update task' });
  }
});

// DELETE /api/home/personal-task/:id - Delete personal task
router.delete('/personal-task/:id', async (req, res) => {
  try {
    const { PersonalTask } = require('../models');
    
    await PersonalTask.deleteOne({ _id: req.params.id, user_id: req.user._id });

    res.json({ done: true });
  } catch (error) {
    console.error('Delete personal task error:', error);
    res.status(500).json({ done: false, message: 'Failed to delete task' });
  }
});

// GET /api/home/greeting - Get greeting
router.get('/greeting', async (req, res) => {
  try {
    res.json({
      done: true,
      body: {
        greeting: 'Welcome back!',
        time: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ done: false, message: 'Failed to fetch greeting' });
  }
});

// GET /api/home/tasks - Get my tasks for dashboard
router.get('/tasks', async (req, res) => {
  try {
    const { Task } = require('../models');
    // params: group_by (0 = assigned to me, 1 = assigned by me), is_calendar_view, selected_date
    const { group_by } = req.query;
    
    let query = { is_archived: false };
    
    // group_by: 0 = Assigned to me, 1 = Assigned by me
    if (group_by === '1') {
        // Assigned by me (I am the reporter)
        query.reporter_id = req.user._id;
    } else {
        // Default: Assigned to me (I am in assignees)
        query.assignees = req.user._id;
    }
    
    // Add logic for filtering completed if needed, or sorting
    // For now return all matching
    
    const tasks = await Task.find(query)
      .populate('project_id', 'name key color_code team_id')
      .populate('status_id', 'name color_code category')
      .populate('assignees', 'name avatar_url')
      .sort({ created_at: -1 })
      .limit(50)
      .lean();
    
    // Get all unique project IDs from tasks
    const projectIds = [...new Set(tasks.map(t => t.project_id?._id?.toString()).filter(Boolean))];
    
    // Fetch statuses for all projects
    const { TaskStatus } = require('../models');
    const allStatuses = await TaskStatus.find({ project_id: { $in: projectIds } }).lean();
    
    // Group statuses by project - convert ObjectIds to strings
    const statusesByProject = {};
    allStatuses.forEach(s => {
        const pid = s.project_id.toString();
        if (!statusesByProject[pid]) statusesByProject[pid] = [];
        statusesByProject[pid].push({
            id: s._id.toString(),  // Convert to string
            name: s.name,
            color_code: s.color_code,
            category: s.category
        });
    });
      
    const mappedTasks = tasks.map(t => {
        const projectId = t.project_id?._id?.toString();
        return {
            ...t,
            id: t._id?.toString(),  // Convert to string
            project_id: t.project_id?._id?.toString(),  // Convert to string for consistency
            team_id: t.project_id?.team_id?.toString(),  // Get team_id from project
            project_name: t.project_id ? t.project_id.name : '',
            project_color: t.project_id ? t.project_id.color_code : '',
            status_id: t.status_id?._id?.toString(),  // Convert to string
            status_name: t.status_id?.name,
            status_color: t.status_id?.color_code,
            project_statuses: statusesByProject[projectId] || []
        };
    });

    // Calculate counts for tabs
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const counts = {
        today: 0,
        upcoming: 0,
        overdue: 0,
        no_due_date: 0
    };
    
    mappedTasks.forEach(t => {
        if (!t.end_date) {
            counts.no_due_date++;
        } else {
            const d = new Date(t.end_date);
            d.setHours(0,0,0,0);
            if (d.getTime() === today.getTime()) counts.today++;
            else if (d.getTime() < today.getTime()) counts.overdue++;
            else if (d.getTime() > today.getTime()) counts.upcoming++;
        }
    });
    
    res.json({
        done: true,
        body: {
            tasks: mappedTasks,
            total: tasks.length,
            ...counts
        }
    });
  } catch (error) {
    console.error('Fetch home tasks error:', error);
    res.status(500).json({ done: false, message: 'Failed to fetch tasks' });
  }
});

// GET /api/home/projects - Get recent/favourite projects
router.get('/projects', async (req, res) => {
   try {
     const { Project, ProjectMember } = require('../models');
     const { view, team_id } = req.query; // 0 = Recent, 1 = Favourites
     
     // Build membership query
     const membershipQuery = { 
       user_id: req.user._id, 
       is_active: true 
     };
     
     // If team_id is provided, filter by team
     if (team_id) {
       const { TeamMember } = require('../models');
       const teamMember = await TeamMember.findOne({ user_id: req.user._id, team_id: team_id, is_active: true });
       if (!teamMember) {
         return res.json({ done: true, body: [] });
       }
     }
     
     // If view=1 (Favourites), filter by is_favorite
     if (view === '1') {
       membershipQuery.is_favorite = true;
     }
     
     // Find projects user is member of
     const memberships = await ProjectMember.find(membershipQuery);
     const projectIds = memberships.map(m => m.project_id);
     
     // Create a lookup for favorite status
     const favoriteMap = {};
     memberships.forEach(m => {
        favoriteMap[m.project_id.toString()] = m.is_favorite;
     });
     
     const projectQuery = { _id: { $in: projectIds }, is_archived: false };
     if (team_id) {
       projectQuery.team_id = team_id;
     }
     
     const projects = await Project.find(projectQuery)
        .sort({ updated_at: -1 })
        .limit(10)
        .lean();
     
     // Map _id to id for frontend compatibility and attach favorite status
     const mappedProjects = projects.map(p => ({
         ...p,
         id: p._id,
         favorite: favoriteMap[p._id.toString()] || false
     }));
        
     res.json({
         done: true,
         body: mappedProjects
     });
   } catch (error) {
     res.status(500).json({ done: false, message: 'Failed to fetch projects' });
   }
});

// GET /api/home/team-projects
router.get('/team-projects', async (req, res) => {
   try {
     const { Project, TeamMember, ProjectMember } = require('../models');
     
     // Maybe grouped by team?
     // Or just all projects available to user
     const memberships = await ProjectMember.find({ user_id: req.user._id, is_active: true });
     const projectIds = memberships.map(m => m.project_id);
     
      const projects = await Project.find({ _id: { $in: projectIds }, is_archived: false })
         .populate('team_id', 'name')
         .lean();
      
      // Map _id to id for frontend compatibility
      const mappedProjects = projects.map(p => ({
          ...p,
          id: p._id
      }));
         
      res.json({
          done: true,
          body: mappedProjects
      });
   } catch (error) {
     res.status(500).json({ done: false, message: 'Failed to fetch team projects' });
   }
});

module.exports = router;

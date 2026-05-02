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
    const taskName = (name || task || '').trim();
    
    if (!taskName) {
      return res.status(400).json({ done: false, message: 'Task name is required' });
    }
    if (taskName.length > 20000) {
      return res.status(400).json({ done: false, message: 'Task name cannot exceed 20000 characters' });
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
        is_completed: newTask.is_completed,
        done: newTask.is_completed
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
        is_completed: task.is_completed,
        done: task.is_completed
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
        is_completed: t.is_completed,
        done: t.is_completed
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
    if (typeof name === 'string') {
      const normalizedName = name.trim();
      if (!normalizedName) {
        return res.status(400).json({ done: false, message: 'Task name is required' });
      }
      if (normalizedName.length > 20000) {
        return res.status(400).json({ done: false, message: 'Task name cannot exceed 20000 characters' });
      }
      task.name = normalizedName;
    }
    
    await task.save();

    res.json({
      done: true,
      body: {
        id: task._id,
        name: task.name,
        is_completed: task.is_completed,
        done: task.is_completed
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
    const { Task, TaskStatus } = require('../models');
    // params: group_by (0 = assigned to me, 1 = assigned by me), current_tab (all, today, upcoming, overdue, no_due_date)
    const { group_by, current_tab = 'all' } = req.query;
    
    let baseQuery = { is_archived: false };
    
    // group_by: 0 = Assigned to me, 1 = Assigned by me
    if (group_by === '1') {
        // Assigned by me (I am the reporter)
        baseQuery.reporter_id = req.user._id;
    } else {
        // Default: Assigned to me (I am in assignees)
        baseQuery.assignees = req.user._id;
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Get counts for all tabs using baseQuery
    const allUserTasks = await Task.find(baseQuery).select('end_date status_id').lean();
    
    // Fetch all "done" statuses to filter out completed tasks from counts if necessary
    // However, usually these filters apply to active tasks.
    const doneStatuses = await TaskStatus.find({ category: 'done' }).select('_id').lean();
    const doneStatusIds = doneStatuses.map(s => s._id.toString());

    const counts = {
        all: allUserTasks.length,
        today: 0,
        upcoming: 0,
        overdue: 0,
        no_due_date: 0
    };

    allUserTasks.forEach(t => {
        const isDone = t.status_id && doneStatusIds.includes(t.status_id.toString());
        
        if (!t.end_date) {
            counts.no_due_date++;
        } else {
            const d = new Date(t.end_date);
            if (d >= todayStart && d <= todayEnd) {
                counts.today++;
            } else if (d > todayEnd) {
                counts.upcoming++;
            } else if (d < todayStart) {
                // Overdue usually means past due date and NOT done
                if (!isDone) {
                    counts.overdue++;
                }
            }
        }
    });

    // Normalize tab name for filtering logic (supporting both PascalCase and lowercase)
    const tab = (current_tab || 'All').toLowerCase();
    
    // Apply specific tab filtering for the result list
    let filterQuery = { ...baseQuery };
    if (tab === 'today') {
        filterQuery.end_date = { $gte: todayStart, $lte: todayEnd };
    } else if (tab === 'upcoming') {
        filterQuery.end_date = { $gt: todayEnd };
    } else if (tab === 'overdue') {
        filterQuery.end_date = { $lt: todayStart };
        // Only show non-completed overdue tasks
        filterQuery.status_id = { $nin: doneStatusIds };
    } else if (tab === 'noduedate' || tab === 'no_due_date') {
        filterQuery.$or = [
            { end_date: { $exists: false } },
            { end_date: null }
        ];
    }
    
    const tasks = await Task.find(filterQuery)
      .populate('project_id', 'name key color_code team_id')
      .populate('status_id', 'name color_code category')
      .populate('assignees', 'name avatar_url')
      .sort({ end_date: 1, created_at: -1 })
      .limit(100)
      .lean();
    
    // Get unique project IDs for secondary population
    const projectIds = [...new Set(tasks.map(t => t.project_id?._id?.toString()).filter(Boolean))];
    const projectStatuses = await TaskStatus.find({ project_id: { $in: projectIds } }).lean();
    
    const statusesByProject = {};
    projectStatuses.forEach(s => {
        const pid = s.project_id.toString();
        if (!statusesByProject[pid]) statusesByProject[pid] = [];
        statusesByProject[pid].push({
            id: s._id.toString(),
            name: s.name,
            color_code: s.color_code,
            category: s.category
        });
    });
      
    const mappedTasks = tasks.map(t => {
        const projectId = t.project_id?._id?.toString();
        return {
            ...t,
            id: t._id?.toString(),
            project_id: projectId,
            team_id: t.project_id?.team_id?.toString(),
            project_name: t.project_id ? t.project_id.name : '',
            project_color: t.project_id ? t.project_id.color_code : '',
            status_id: t.status_id?._id?.toString(),
            status_name: t.status_id?.name,
            status_color: t.status_id?.color_code,
            project_statuses: statusesByProject[projectId] || []
        };
    });

    res.json({
        done: true,
        body: {
            tasks: mappedTasks,
            total: mappedTasks.length,
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

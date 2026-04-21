const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const constants = require('../config/constants');
const { User, Task, Project, TaskStatus, TeamMember, ProjectMember, TimeLog, RunningTimer, ActivityLog, TaskLabel, TaskPhase } = require('../models');
const SocketEvents = require('../config/socket-events');
const { generateTaskKeyForProject } = require('../utils/task-key');
const notificationService = require('../services/notification.service');

let io;

/**
 * Initialize Socket.io
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5000',
        process.env.FRONTEND_URL
      ].filter(Boolean),
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = jwt.verify(token, constants.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = user;
      
      // Update user's socket ID
      await User.findByIdAndUpdate(user._id, { socket_id: socket.id });
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} (User: ${socket.user?.email})`);
    
    // Join user's personal room
    socket.join(`user:${socket.user._id}`);
    
    // Join project room
    socket.on('join:project', (projectId) => {
      socket.join(`project:${projectId}`);
      // console.log(`User ${socket.user.email} joined project: ${projectId}`);
    });
    
    // Leave project room
    socket.on('leave:project', (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    const recalculateParentFromSubtasks = async (parentTaskId) => {
      if (!parentTaskId) return null;

      const parentTask = await Task.findById(parentTaskId).select('project_id status_id');
      if (!parentTask) return null;

      const subtasks = await Task.find({
        parent_task_id: parentTaskId,
        is_archived: false,
        is_trashed: { $ne: true },
      }).select('status_id');

      const totalTasksCount = subtasks.length;
      if (totalTasksCount === 0) {
        // No subtasks: keep parent status manual as-is, only expose current progress value.
        return {
          parentTask: await Task.findById(parentTaskId).populate('status_id'),
          totalTasksCount: 0,
          completedCount: 0,
          progress: 0,
          statusCategory: null,
        };
      }

      const statusIds = subtasks.map(s => s.status_id).filter(Boolean);
      const statuses = await TaskStatus.find({ _id: { $in: statusIds } }).select('_id category');
      const statusCategoryMap = new Map(statuses.map(s => [String(s._id), s.category]));

      let completedCount = 0;
      let inProgressCount = 0;

      for (const subtask of subtasks) {
        const category = statusCategoryMap.get(String(subtask.status_id)) || 'todo';
        if (category === 'done') completedCount += 1;
        else if (category === 'doing') inProgressCount += 1;
      }

      let targetCategory = 'todo';
      let nextProgress = 0;
      if (completedCount === totalTasksCount) {
        targetCategory = 'done';
        nextProgress = 100;
      } else if (inProgressCount > 0 || completedCount > 0) {
        targetCategory = 'doing';
        nextProgress = Math.round((completedCount / totalTasksCount) * 100);
      }

      const targetStatus = await TaskStatus.findOne({
        project_id: parentTask.project_id,
        category: targetCategory,
      })
        .sort({ is_default: -1, sort_order: 1, created_at: 1 })
        .select('_id category color_code');

      const update = {
        progress: nextProgress,
        completed_at: targetCategory === 'done' ? new Date() : null,
      };
      if (targetStatus?._id) {
        update.status_id = targetStatus._id;
      }

      const updatedParent = await Task.findByIdAndUpdate(parentTaskId, update, { new: true }).populate('status_id');
      if (!updatedParent) return null;

      return {
        parentTask: updatedParent,
        totalTasksCount,
        completedCount,
        progress: nextProgress,
        statusCategory: {
          is_todo: targetCategory === 'todo',
          is_doing: targetCategory === 'doing',
          is_done: targetCategory === 'done',
        },
      };
    };
    
    // --- LEGACY EVENT HANDLERS (Keep for backward compatibility) ---
    socket.on('task:create', (data) => {
      io.to(`project:${data.project_id}`).emit('task:created', data);
    });
    socket.on('task:update', (data) => {
      io.to(`project:${data.project_id}`).emit('task:updated', data);
    });
    socket.on('task:delete', (data) => {
      io.to(`project:${data.project_id}`).emit('task:deleted', data);
    });
    socket.on('task:move', (data) => {
      io.to(`project:${data.project_id}`).emit('task:moved', data);
    });
    socket.on('comment:add', (data) => {
      io.to(`project:${data.project_id}`).emit('comment:added', data);
    });
    
    // --- NEW NUMERIC SOCKET EVENTS ---
    
    // QUICK_TASK (Create Task)
    socket.on(SocketEvents.QUICK_TASK.toString(), async (jsonString) => {
      console.log('📝 QUICK_TASK event received:', jsonString);
      try {
        const data = JSON.parse(jsonString);
        const {
          name,
          description,
          project_id,
          reporter_id,
          end_date,
          start_date,
          status_id: requestedStatusId,
          priority_id: requestedPriorityId,
          priority: requestedPriority,
          phase_id: requestedPhaseId,
          parent_task_id: requestedParentTaskId
        } = data;
        
        if (!name || !project_id) return;
        
        // Resolve parent task ID
        const parent_task_id = 
          requestedParentTaskId && requestedParentTaskId !== 'null' && requestedParentTaskId !== 'undefined'
            ? requestedParentTaskId 
            : null;

        // Resolve status
        let status_id = null;
        let resolvedStatusCategory = 'todo';
        if (requestedStatusId) {
          const requestedStatus = await TaskStatus.findOne({ _id: requestedStatusId, project_id });
          if (requestedStatus) {
            status_id = requestedStatus._id;
            resolvedStatusCategory = requestedStatus.category || 'todo';
          }
        }

        if (!status_id) {
          const defaultStatus = await TaskStatus.findOne({ project_id, is_default: true });
          status_id = defaultStatus?._id || null;
          resolvedStatusCategory = defaultStatus?.category || 'todo';
        }

        // Resolve priority
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        let resolvedPriority = 'medium';
        const incomingPriority = requestedPriorityId || requestedPriority;
        if (typeof incomingPriority === 'string' && validPriorities.includes(incomingPriority.toLowerCase())) {
          resolvedPriority = incomingPriority.toLowerCase();
        }

        // Create Task
        const isDoneOnCreate = resolvedStatusCategory === 'done';
        const task = await Task.create({
            name,
            description: description || '',
            project_id,
            task_key: await generateTaskKeyForProject(project_id),
            status_id,
            phase_id: requestedPhaseId || null,
            parent_task_id,
            reporter_id: socket.user._id,
            end_date: end_date ? new Date(end_date) : undefined,
            start_date: start_date ? new Date(start_date) : new Date(),
            priority: resolvedPriority,
            progress: isDoneOnCreate ? 100 : 0,
            completed_at: isDoneOnCreate ? new Date() : null
        });
        
        const populatedTask = await Task.findById(task._id)
            .populate('project_id', 'name key color_code')
            .populate('status_id', 'name color_code category')
            .populate('phase_id', 'name color_code')
            .populate('reporter_id', 'name email avatar_url');

        const taskObj = populatedTask.toObject();
        taskObj.id = task._id;
        taskObj.parent_task_id = task.parent_task_id ? task.parent_task_id.toString() : null;
        taskObj.priority_id = resolvedPriority;
        taskObj.assignees = [];
        taskObj.reporter = populatedTask?.reporter_id?.name || socket.user?.name || '';
        taskObj.reporter_id = populatedTask?.reporter_id?._id?.toString?.() || socket.user?._id?.toString?.() || '';
        taskObj.completed_at = task.completed_at || null;
        taskObj.completedAt = task.completed_at || null;
        taskObj.complete_ratio = task.progress || 0;

        // Send once to creator, and broadcast to all OTHER users in the same project room.
        // Using io.to(room).emit sends back to sender too (if sender already joined room),
        // which causes duplicate task rows in UI.
        socket.emit(SocketEvents.QUICK_TASK.toString(), taskObj);
        socket.to(`project:${project_id}`).emit(SocketEvents.QUICK_TASK.toString(), taskObj);

        // If this is a subtask, recalculate parent task progress/status immediately.
        if (parent_task_id) {
          const parentRecalc = await recalculateParentFromSubtasks(parent_task_id);
          if (parentRecalc?.parentTask) {
            const parentResponse = {
              id: parentRecalc.parentTask._id.toString(),
              task_id: parentRecalc.parentTask._id.toString(),
              parent_task: null,
              complete_ratio: parentRecalc.progress,
              progress_value: parentRecalc.progress,
              total_tasks_count: parentRecalc.totalTasksCount,
              completed_count: parentRecalc.completedCount,
            };
            socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), parentResponse);
            io.to(`project:${project_id}`).emit(SocketEvents.GET_TASK_PROGRESS.toString(), parentResponse);

            if (parentRecalc.statusCategory) {
              const parentStatusResponse = {
                id: parentRecalc.parentTask._id.toString(),
                status_id: parentRecalc.parentTask.status_id?._id?.toString?.() || parentRecalc.parentTask.status_id?.toString?.() || '',
                color_code: parentRecalc.parentTask.status_id?.color_code,
                complete_ratio: parentRecalc.progress,
                completed_at: parentRecalc.parentTask.completed_at || null,
                statusCategory: parentRecalc.statusCategory,
              };
              socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), parentStatusResponse);
              io.to(`project:${project_id}`).emit(SocketEvents.TASK_STATUS_CHANGE.toString(), parentStatusResponse);
            }
          }
        }
        
        await ActivityLog.create({
            task_id: task._id,
            project_id: project_id,
            done_by: socket.user._id,
            log_type: 'create',
            log_text: `created the task: ${name}`,
            attribute_type: 'CREATE'
        });
      } catch (error) {
        console.error('❌ Socket QUICK_TASK error:', error);
      }
    });

    // QUICK_ASSIGNEES_UPDATE
    socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), async (jsonString) => {
       try {
         const data = JSON.parse(jsonString);
         const { task_id, team_member_id, project_id, mode } = data;
         
         const teamMember = await TeamMember.findById(team_member_id).populate('user_id', 'name email avatar_url');
         if (!teamMember) return;

         const userId = teamMember.user_id._id;
         let task;

         if (mode === 1) { // Remove
           task = await Task.findByIdAndUpdate(task_id, { $pull: { assignees: userId } }, { new: true }).populate('assignees', 'name email avatar_url');
         } else { // Add
           task = await Task.findByIdAndUpdate(task_id, { $addToSet: { assignees: userId } }, { new: true }).populate('assignees', 'name email avatar_url');
         }

         if (!task) return;

         const teamMembersForTask = await TeamMember.find({ user_id: { $in: task.assignees.map(a => a._id) } });
         const userToTeamMemberMap = {};
         teamMembersForTask.forEach(tm => userToTeamMemberMap[tm.user_id.toString()] = tm._id.toString());

         const assignees = task.assignees.map(a => ({
           team_member_id: userToTeamMemberMap[a._id.toString()],
           id: a._id.toString(),
           name: a.name,
           email: a.email,
           avatar_url: a.avatar_url
         }));

         const response = { id: task_id, assignees, names: assignees };
         socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), response);
         io.to(`project:${project_id}`).emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), response);
         io.to(`project:${project_id}`).emit(SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), response);

         // Trigger Notification
         await notificationService.notifyTaskAssignment(
           task_id, 
           userId, 
           socket.user._id, 
           mode === 1 ? 'remove' : 'add', 
           project_id
         );
       } catch (error) {
         console.error('❌ Socket QUICK_ASSIGNEES_UPDATE error:', error);
       }
    });

    // TASK_NAME_CHANGE
    socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), async (str) => {
        try {
            const data = JSON.parse(str);
            const { task_id, name } = data;
            const task = await Task.findByIdAndUpdate(task_id, { name }, { new: true });
            if(task) {
                const res = { id: task_id, name };
                socket.emit(SocketEvents.TASK_NAME_CHANGE.toString(), res);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_NAME_CHANGE.toString(), res);
            }
        } catch(e) { console.error(e); }
    });

    // TASK_STATUS_CHANGE
    socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), async (str) => {
        try {
            const data = JSON.parse(str);
            const { task_id, status_id } = data;
            const status = await TaskStatus.findById(status_id).select('category color_code');
            const isDone = status?.category === 'done';
            // Enforce dependency rule on server: a task cannot move to done
            // while any of its blocking dependencies are not completed.
            if (isDone) {
              const TaskDependency = require('../models/TaskDependency');
              const dependencies = await TaskDependency.find({ task_id }).populate({
                path: 'related_task_id',
                select: 'status_id',
                populate: { path: 'status_id', select: 'category' }
              });

              const hasIncompleteDependency = dependencies.some(dep => {
                const relatedCategory = dep?.related_task_id?.status_id?.category;
                return relatedCategory !== 'done';
              });

              if (hasIncompleteDependency) {
                socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), {
                  id: task_id,
                  status_id,
                  completed_deps: false,
                });
                return;
              }
            }
            const update = {
              status_id,
              progress: isDone ? 100 : 0,
              completed_at: isDone ? new Date() : null
            };

            const task = await Task.findByIdAndUpdate(task_id, update, { new: true }).populate('status_id');
            if (task) {
                const category = task.status_id?.category || status?.category || 'todo';
                const response = {
                  id: task_id,
                  status_id,
                  color_code: task.status_id?.color_code || status?.color_code,
                  complete_ratio: typeof task.progress === 'number' ? task.progress : 0,
                  completed_at: task.completed_at || null,
                  statusCategory: {
                    is_todo: category === 'todo',
                    is_doing: category === 'doing',
                    is_done: category === 'done'
                  }
                };
                socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_STATUS_CHANGE.toString(), response);

                // If this was a subtask, recalculate parent progress/status.
                if (task.parent_task_id) {
                  const parentRecalc = await recalculateParentFromSubtasks(task.parent_task_id);
                  if (parentRecalc?.parentTask) {
                    const parentProgressResponse = {
                      id: parentRecalc.parentTask._id.toString(),
                      task_id: parentRecalc.parentTask._id.toString(),
                      parent_task: null,
                      complete_ratio: parentRecalc.progress,
                      progress_value: parentRecalc.progress,
                      total_tasks_count: parentRecalc.totalTasksCount,
                      completed_count: parentRecalc.completedCount,
                    };
                    socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), parentProgressResponse);
                    io.to(`project:${task.project_id}`).emit(SocketEvents.GET_TASK_PROGRESS.toString(), parentProgressResponse);

                    if (parentRecalc.statusCategory) {
                      const parentStatusResponse = {
                        id: parentRecalc.parentTask._id.toString(),
                        status_id: parentRecalc.parentTask.status_id?._id?.toString?.() || parentRecalc.parentTask.status_id?.toString?.() || '',
                        color_code: parentRecalc.parentTask.status_id?.color_code,
                        complete_ratio: parentRecalc.progress,
                        completed_at: parentRecalc.parentTask.completed_at || null,
                        statusCategory: parentRecalc.statusCategory,
                      };
                      socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), parentStatusResponse);
                      io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_STATUS_CHANGE.toString(), parentStatusResponse);
                    }
                  }
                }
            }
        } catch(e) { console.error(e); }
    });

    // TASK_PRIORITY_CHANGE
    socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), async (str) => {
        try {
            const data = JSON.parse(str);
            const { task_id, priority_id } = data;
            const validPriorities = ['low', 'medium', 'high', 'urgent'];
            let priority = validPriorities.includes(priority_id) ? priority_id : 'medium';
            const task = await Task.findByIdAndUpdate(task_id, { priority }, { new: true });
            if (task) {
                const priorityColors = { low: '#87d068', medium: '#2db7f5', high: '#ff9800', urgent: '#f50' };
                const response = { id: task_id, priority_id: priority, priority, color_code: priorityColors[priority] };
                socket.emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // TASK_PHASE_CHANGE
    socket.on(SocketEvents.TASK_PHASE_CHANGE.toString(), async (str) => {
        try {
            const data = typeof str === 'string' ? JSON.parse(str) : str;
            const { task_id, phase_id } = data;
            const task = await Task.findByIdAndUpdate(task_id, { phase_id: phase_id || null }, { new: true }).populate('phase_id');
            if (task) {
                const response = { id: task_id, phase_id, phase_name: task.phase_id?.name, phase_color: task.phase_id?.color_code };
                socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_PHASE_CHANGE.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // TASK_LABELS_CHANGE
    socket.on(SocketEvents.TASK_LABELS_CHANGE.toString(), async (str) => {
        try {
            const data = typeof str === 'string' ? JSON.parse(str) : str;
            const { task_id, label_id, is_selected } = data;
            const currentTask = await Task.findById(task_id).select('labels project_id');
            if (!currentTask) return;

            const currentLabelIds = (currentTask.labels || []).map(id => id?.toString());
            const shouldSelect =
              typeof is_selected === 'boolean' ? is_selected : !currentLabelIds.includes(label_id?.toString());
            const update = shouldSelect ? { $addToSet: { labels: label_id } } : { $pull: { labels: label_id } };
            const task = await Task.findByIdAndUpdate(task_id, update, { new: true }).populate('labels');
            
            if (task) {
                const project = await Project.findById(task.project_id).select('team_id');
                const allLabels = project?.team_id
                  ? await TaskLabel.find({ team_id: project.team_id }).sort({ created_at: 1 })
                  : [];
                const response = {
                  id: task_id,
                  label_id,
                  is_selected: shouldSelect,
                  is_new: false,
                  labels: task.labels.map(l => ({
                    id: l._id.toString(),
                    name: l.name,
                    color_code: l.color_code
                  })),
                  all_labels: allLabels.map(l => ({
                    id: l._id.toString(),
                    name: l.name,
                    color_code: l.color_code
                  }))
                };
                socket.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), response);
                socket.to(`project:${task.project_id}`).emit(SocketEvents.TASK_LABELS_CHANGE.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // CREATE_LABEL
    socket.on(SocketEvents.CREATE_LABEL.toString(), async (str) => {
        try {
            const data = typeof str === 'string' ? JSON.parse(str) : str;
            const { task_id, label, team_id } = data || {};
            const labelName = typeof label === 'string' ? label.trim() : '';
            if (!task_id || !labelName) return;

            const task = await Task.findById(task_id).select('project_id');
            if (!task) return;

            const project = await Project.findById(task.project_id).select('team_id');
            const resolvedTeamId = team_id || project?.team_id?.toString();
            if (!resolvedTeamId) return;

            const escaped = labelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let createdLabel = await TaskLabel.findOne({
              team_id: resolvedTeamId,
              name: { $regex: `^${escaped}$`, $options: 'i' }
            });

            if (!createdLabel) {
              try {
                const labelColors = [
                  '#154c9b', '#3b7ad4', '#70a6f3', '#7781ca', '#9877ca',
                  '#c178c9', '#ee87c5', '#ca7881', '#75c9c0', '#75c997',
                  '#80ca79', '#aacb78', '#cbbc78', '#cb9878', '#bb774c',
                  '#905b39', '#903737', '#bf4949', '#f37070', '#ff9c3c',
                  '#fbc84c', '#cbc8a1', '#a9a9a9', '#767676'
                ];
                const randomColor = labelColors[Math.floor(Math.random() * labelColors.length)];

                createdLabel = await TaskLabel.create({
                  name: labelName,
                  team_id: resolvedTeamId,
                  color_code: randomColor
                });
              } catch (createError) {
                if (createError?.code === 11000) {
                  createdLabel = await TaskLabel.findOne({
                    team_id: resolvedTeamId,
                    name: { $regex: `^${escaped}$`, $options: 'i' }
                  });
                } else {
                  throw createError;
                }
              }
            }

            if (!createdLabel) return;

            const updatedTask = await Task.findByIdAndUpdate(
              task_id,
              { $addToSet: { labels: createdLabel._id } },
              { new: true }
            ).populate('labels');

            if (!updatedTask) return;

            const allLabels = await TaskLabel.find({ team_id: resolvedTeamId }).sort({ created_at: 1 });
            const response = {
              id: task_id,
              label_id: createdLabel._id.toString(),
              is_selected: true,
              is_new: true,
              labels: updatedTask.labels.map(l => ({
                id: l._id.toString(),
                name: l.name,
                color_code: l.color_code
              })),
              all_labels: allLabels.map(l => ({
                id: l._id.toString(),
                name: l.name,
                color_code: l.color_code
              }))
            };

            socket.emit(SocketEvents.CREATE_LABEL.toString(), response);
            socket.to(`project:${updatedTask.project_id}`).emit(SocketEvents.CREATE_LABEL.toString(), response);

            // Keep both label events in sync for consumers listening only to TASK_LABELS_CHANGE
            socket.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), response);
            socket.to(`project:${updatedTask.project_id}`).emit(SocketEvents.TASK_LABELS_CHANGE.toString(), response);
        } catch (e) { console.error(e); }
    });

    // TASK_DESCRIPTION_CHANGE
    socket.on(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), async (str) => {
        try {
            const data = JSON.parse(str);
            const { task_id, description } = data;
            const task = await Task.findByIdAndUpdate(task_id, { description }, { new: true });
            if (task) {
                const response = { id: task_id, description };
                socket.emit(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // TASK_CUSTOM_COLUMN_UPDATE
    socket.on(SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(), async (payload) => {
        try {
            const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
            const { task_id, column_key, value } = data || {};
            if (!task_id || !column_key) return;

            const task = await Task.findById(task_id);
            if (!task) return;

            if (!task.custom_column_values || typeof task.custom_column_values !== 'object') {
              task.custom_column_values = {};
            }

            task.custom_column_values[String(column_key)] = value;
            task.markModified('custom_column_values');
            await task.save();

            const response = {
              task_id: String(task_id),
              column_key: String(column_key),
              value,
            };

            socket.emit(SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(), response);
            socket.to(`project:${task.project_id}`).emit(SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(), response);
        } catch (e) { console.error(e); }
    });

    // CUSTOM_COLUMN_PINNED_CHANGE / custom-column metadata change broadcast
    // This event is used by frontend to notify all project members to refetch columns
    // after create/update/delete/visibility changes.
    socket.on(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), async (payload) => {
        try {
            const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
            const { project_id } = data || {};
            if (!project_id) return;

            socket.emit(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), data);
            socket.to(`project:${project_id}`).emit(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), data);
        } catch (e) { console.error(e); }
    });

    // TASK_TIME_ESTIMATION_CHANGE
    socket.on(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), async (str) => {
        try {
            const data = typeof str === 'string' ? JSON.parse(str) : str;
            const { task_id, total_hours, total_minutes } = data;
            const hours = parseInt(total_hours) || 0;
            const minutes = parseInt(total_minutes) || 0;
            const estimated_hours = hours + minutes / 60;
            const task = await Task.findByIdAndUpdate(
              task_id,
              { estimated_hours },
              { new: true }
            );
            if (task) {
                const response = { id: task_id, total_hours: hours, total_minutes: minutes };
                socket.emit(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // TASK_BILLABLE_CHANGE
    socket.on(SocketEvents.TASK_BILLABLE_CHANGE.toString(), async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const { task_id, billable } = payload;
            const task = await Task.findByIdAndUpdate(task_id, { billable }, { new: true });
            if (task) {
                const response = { id: task_id, billable };
                socket.emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // TASK_START_DATE_CHANGE
    socket.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), async (str) => {
        try {
            const data = JSON.parse(str);
            const { task_id, start_date } = data;
            const task = await Task.findByIdAndUpdate(task_id, { start_date: start_date ? new Date(start_date) : null }, { new: true });
            if (task) {
                const response = { id: task_id, start_date: task.start_date };
                socket.emit(SocketEvents.TASK_START_DATE_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_START_DATE_CHANGE.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // TASK_END_DATE_CHANGE
    socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), async (str) => {
        try {
            const data = JSON.parse(str);
            const { task_id, end_date } = data;
            const task = await Task.findByIdAndUpdate(task_id, { 
              end_date: end_date ? new Date(end_date) : null,
              due_date: end_date ? new Date(end_date) : null
            }, { new: true });
            if (task) {
                const response = { id: task_id, end_date: task.end_date, due_date: task.due_date };
                socket.emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // TASK_RECURRING_CHANGE
    socket.on(SocketEvents.TASK_RECURRING_CHANGE.toString(), async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const { task_id, schedule_id } = payload;
            const task = await Task.findByIdAndUpdate(task_id, { schedule_id: schedule_id || null }, { new: true });
            if (task) {
                const response = { task_id, schedule_id };
                socket.emit(SocketEvents.TASK_RECURRING_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_RECURRING_CHANGE.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // UPDATE_TASK_PROGRESS
    socket.on(SocketEvents.UPDATE_TASK_PROGRESS.toString(), async (str) => {
        try {
            const data = typeof str === 'string' ? JSON.parse(str) : str;
            const { task_id } = data;
            const rawProgress = data.progress_value ?? data.progress;
            const progressValue = Math.min(100, Math.max(0, parseInt(rawProgress) || 0));
            const task = await Task.findByIdAndUpdate(task_id, { progress: progressValue }, { new: true });
            if (task) {
                const response = { task_id, progress_value: progressValue };
                socket.emit(SocketEvents.TASK_PROGRESS_UPDATED.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_PROGRESS_UPDATED.toString(), response);
            }
        } catch(e) { console.error(e); }
    });

    // UPDATE_TASK_WEIGHT
    socket.on(SocketEvents.UPDATE_TASK_WEIGHT.toString(), async (str) => {
        try {
            const data = typeof str === 'string' ? JSON.parse(str) : str;
            const { task_id, weight } = data;
            const weightValue = Math.min(100, Math.max(0, parseInt(weight) || 0));
            const task = await Task.findByIdAndUpdate(task_id, { weight: weightValue }, { new: true });
            if (task) {
                const response = { task_id, weight: weightValue };
                socket.emit(SocketEvents.TASK_PROGRESS_UPDATED.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_PROGRESS_UPDATED.toString(), response);
            }
        } catch (e) { console.error(e); }
    });

    // GET_TASK_PROGRESS
    socket.on(SocketEvents.GET_TASK_PROGRESS.toString(), async (taskIdOrPayload, callback) => {
        try {
            const parsed = typeof taskIdOrPayload === 'string'
              ? (() => { try { return JSON.parse(taskIdOrPayload); } catch { return { task_id: taskIdOrPayload }; } })()
              : (taskIdOrPayload || {});
            const task_id = parsed.task_id || parsed.id || taskIdOrPayload;
            if (!task_id) return;

            const task = await Task.findById(task_id).select('progress parent_task_id project_id');
            if (!task) return;
            const subtasks = await Task.find({
              parent_task_id: task._id,
              is_archived: false,
              is_trashed: { $ne: true },
            }).select('status_id');

            let totalTasksCount = subtasks.length;
            let completedCount = 0;
            let progress = typeof task.progress === 'number' ? task.progress : 0;

            if (totalTasksCount > 0) {
              const statusIds = subtasks.map(s => s.status_id).filter(Boolean);
              const statuses = await TaskStatus.find({ _id: { $in: statusIds } }).select('_id category');
              const statusCategoryMap = new Map(statuses.map(s => [String(s._id), s.category]));

              for (const subtask of subtasks) {
                const category = statusCategoryMap.get(String(subtask.status_id)) || 'todo';
                if (category === 'done') completedCount += 1;
              }
              progress = Math.round((completedCount / totalTasksCount) * 100);
            }

            const response = {
              id: task._id.toString(),
              task_id: task._id.toString(),
              parent_task: task.parent_task_id ? task.parent_task_id.toString() : null,
              complete_ratio: progress,
              progress_value: progress,
              total_tasks_count: totalTasksCount,
              completed_count: completedCount
            };

            if (typeof callback === 'function') {
              callback(response);
            }
            socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), response);
            io.to(`project:${task.project_id}`).emit(SocketEvents.GET_TASK_PROGRESS.toString(), response);
        } catch (e) { console.error(e); }
    });

    // GET_DONE_STATUSES
    socket.on(SocketEvents.GET_DONE_STATUSES.toString(), async (projectId, callback) => {
        try {
            if (!projectId) {
              if (typeof callback === 'function') callback([]);
              return;
            }
            const statuses = await TaskStatus.find({
              project_id: projectId,
              category: 'done'
            }).select('_id name color_code category').sort({ sort_order: 1 });

            const body = statuses.map(s => ({
              id: s._id.toString(),
              name: s.name,
              color_code: s.color_code,
              category: s.category
            }));
            if (typeof callback === 'function') callback(body);
            socket.emit(SocketEvents.GET_DONE_STATUSES.toString(), body);
        } catch (e) {
            if (typeof callback === 'function') callback([]);
            console.error(e);
        }
    });

    // TASK_SUBSCRIBERS_CHANGE
    socket.on(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), async (payload) => {
        try {
            const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
            const { task_id, team_member_id, user_id, mode } = data || {};
            if (!task_id || (!team_member_id && !user_id)) return;

            let targetUserId = user_id;
            if (!targetUserId && team_member_id) {
              const teamMember = await TeamMember.findById(team_member_id).select('user_id');
              targetUserId = teamMember?.user_id?.toString();
            }
            if (!targetUserId) return;

            const update =
              mode === 1
                ? { $pull: { subscribers: targetUserId } }
                : { $addToSet: { subscribers: targetUserId } };

            const task = await Task.findByIdAndUpdate(task_id, update, { new: true }).populate(
              'subscribers',
              'name email avatar_url'
            );
            if (!task) return;

            const teamMembers = await TeamMember.find({
              user_id: { $in: (task.subscribers || []).map(s => s?._id) }
            }).select('_id user_id');
            const userToTeamMap = {};
            teamMembers.forEach(tm => {
              userToTeamMap[tm.user_id.toString()] = tm._id.toString();
            });

            const subscribers = (task.subscribers || []).map(s => ({
              team_member_id: userToTeamMap[s._id.toString()] || s._id.toString(),
              user_id: s._id.toString(),
              name: s.name || '',
              email: s.email || '',
              avatar_url: s.avatar_url || ''
            }));

            socket.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), subscribers);
            io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), subscribers);
        } catch (e) { console.error(e); }
    });

    // TASK_TIMER_START / STOP
    socket.on(SocketEvents.TASK_TIMER_START.toString(), async (str) => {
        try {
            const { task_id } = JSON.parse(str);
            const task = await Task.findById(task_id).select('project_id');
            if (!task) return;
            await RunningTimer.deleteMany({ user_id: socket.user._id });
            const timer = await RunningTimer.create({
              task_id,
              user_id: socket.user._id,
              project_id: task.project_id,
              start_time: new Date()
            });
            const res = {
              task_id: task_id?.toString(),
              start_time: timer.start_time.getTime(),
              user_id: socket.user._id?.toString()
            };
            socket.emit(SocketEvents.TASK_TIMER_START.toString(), res);
            io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_TIMER_START.toString(), {
              ...res,
              user_name: socket.user.name
            });
        } catch(e) { console.error(e); }
    });

    socket.on(SocketEvents.TASK_TIMER_STOP.toString(), async (str) => {
        try {
            const { task_id, description } = JSON.parse(str);
            const timer = await RunningTimer.findOne({ user_id: socket.user._id, task_id });
            if (timer) {
                const endTime = new Date();
                const hours = (endTime - timer.start_time) / (1000 * 60 * 60);
                await TimeLog.create({ task_id, user_id: socket.user._id, hours, description: description || '', logged_date: endTime });
                await RunningTimer.deleteOne({ _id: timer._id });
                const res = {
                  task_id: task_id?.toString(),
                  user_id: socket.user._id?.toString(),
                  duration_hours: hours
                };
                socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), res);
                io.to(`project:${timer.project_id}`).emit(SocketEvents.TASK_TIMER_STOP.toString(), { ...res, user_name: socket.user.name });
            }
        } catch(e) { console.error(e); }
    });

    // ======= GROUP CHAT EVENTS =======
    const { ProjectComment } = require('../models');

    // chat:history - Load paginated messages on join
    socket.on('chat:history', async ({ projectId, before, limit = 30 }) => {
        try {
            const query = { project_id: projectId };
            if (before) query.created_at = { $lt: new Date(before) };
            const msgs = await ProjectComment.find(query)
                .sort({ created_at: 1 })
                .limit(limit)
                .populate('user_id', 'name avatar_url')
                .lean();
            const formatted = msgs.map(m => ({
                id: m._id.toString(),
                project_id: m.project_id.toString(),
                user_id: m.user_id?._id?.toString(),
                username: m.user_id?.name || 'Unknown',
                avatar: m.user_id?.avatar_url || null,
                message: m.content,
                timestamp: m.created_at,
                isDeleted: !!m.isDeleted,
                reactions: m.reactions || [],
                hiddenFor: (m.hiddenFor || []).map(id => id.toString()),
                readBy: (m.readBy || []).map(r => ({
                    user_id: r.user_id?.toString(),
                    name: r.name,
                    avatar: r.avatar || null,
                    read_at: r.read_at
                }))
            }));
            socket.emit('chat:history', formatted);
        } catch(e) { console.error('chat:history error', e); }
    });

    // chat:send - Save message & broadcast to project room
    socket.on('chat:send', async ({ projectId, message }) => {
        try {
            if (!message?.trim() || !projectId) return;
            const comment = await ProjectComment.create({
                project_id: projectId,
                user_id: socket.user._id,
                content: message.trim(),
                readBy: [{ user_id: socket.user._id, name: socket.user.name }]
            });
            const payload = {
                id: comment._id.toString(),
                project_id: projectId,
                user_id: socket.user._id.toString(),
                username: socket.user.name,
                avatar: socket.user.avatar_url || null,
                message: message.trim(),
                timestamp: comment.created_at,
                isDeleted: false,
                readBy: [{ user_id: socket.user._id.toString(), name: socket.user.name }]
            };
            io.to(`project:${projectId}`).emit('chat:message', payload);
        } catch(e) { console.error('chat:send error', e); }
    });

    // Soft delete or hide message
    socket.on('chat:delete', async ({ projectId, messageId, type = 'everyone' }) => {
        try {
            const comment = await ProjectComment.findById(messageId);
            if (!comment) return;

            if (type === 'everyone') {
                // Only sender can delete for everyone
                if (comment.user_id.toString() !== socket.user._id.toString()) return;
                
                await ProjectComment.updateOne(
                    { _id: messageId },
                    { 
                        $set: { isDeleted: true, content: 'This message was deleted' },
                        $addToSet: { hiddenFor: socket.user._id } // Auto-hide for sender
                    }
                );
                
                io.to(`project:${projectId}`).emit('message_deleted', { messageId });
                // Also tell the sender specifically to hide it instantly
                socket.emit('message_hidden', { messageId });
            } else if (type === 'me') {
                // Add user ID to hiddenFor array (Delete for Me / Remove from chat)
                await ProjectComment.updateOne(
                    { _id: messageId },
                    { $addToSet: { hiddenFor: socket.user._id } }
                );
                
                // Tell the specific user to hide it locally
                socket.emit('message_hidden', { messageId });
            }
        } catch(e) { console.error('chat:delete error', e); }
    });

    // typing_start / typing_stop
    socket.on('typing_start', ({ projectId }) => {
        socket.to(`project:${projectId}`).emit('typing_start', {
            user_id: socket.user._id.toString(),
            username: socket.user.name
        });
    });

    socket.on('typing_stop', ({ projectId }) => {
        socket.to(`project:${projectId}`).emit('typing_stop', {
            user_id: socket.user._id.toString(),
            username: socket.user.name
        });
    });

    // message_read - Mark messages as read by current user
    socket.on('message_read', async ({ projectId }) => {
        try {
            await ProjectComment.updateMany(
                {
                    project_id: projectId,
                    user_id: { $ne: socket.user._id }, // Don't mark own messages as read by self
                    'readBy.user_id': { $ne: socket.user._id }
                },
                { 
                    $addToSet: { 
                        readBy: { 
                            user_id: socket.user._id, 
                            name: socket.user.name, 
                            avatar: socket.user.avatar_url || null,
                            read_at: new Date() 
                        } 
                    } 
                }
            );
            io.to(`project:${projectId}`).emit('message_read', {
                user_id: socket.user._id.toString(),
                username: socket.user.name,
                avatar: socket.user.avatar_url || null
            });
        } catch(e) { console.error('message_read error', e); }
    });

    // add_reaction - Add emoji reaction to message (Constraint: 1 per user)
    socket.on('add_reaction', async ({ projectId, messageId, emoji }) => {
        try {
            // First, remove any existing reactions by this user on this message
            await ProjectComment.updateOne(
                { _id: messageId },
                { $pull: { 'reactions.$[].users': { user_id: socket.user._id } } }
            );

            // Add the new reaction
            let updated = await ProjectComment.findOneAndUpdate(
                { _id: messageId, 'reactions.emoji': emoji },
                { $addToSet: { 'reactions.$.users': { user_id: socket.user._id, name: socket.user.name } } },
                { new: true }
            );

            if (!updated) {
                updated = await ProjectComment.findByIdAndUpdate(
                    messageId,
                    { $push: { reactions: { emoji, users: [{ user_id: socket.user._id, name: socket.user.name }] } } },
                    { new: true }
                );
            }

            io.to(`project:${projectId}`).emit('message_reaction_updated', {
                messageId,
                reactions: updated.reactions
            });
        } catch(e) { console.error('add_reaction error', e); }
    });

    // remove_reaction - Remove emoji reaction
    socket.on('remove_reaction', async ({ projectId, messageId, emoji }) => {
        try {
            const updated = await ProjectComment.findOneAndUpdate(
                { _id: messageId, 'reactions.emoji': emoji },
                { $pull: { 'reactions.$.users': { user_id: socket.user._id } } },
                { new: true }
            );
            
            if (updated) {
                // Remove the reaction entry if no users left
                const cleaned = await ProjectComment.findOneAndUpdate(
                    { _id: messageId, 'reactions.emoji': emoji, 'reactions.users': { $size: 0 } },
                    { $pull: { reactions: { emoji } } },
                    { new: true }
                ) || updated;

                io.to(`project:${projectId}`).emit('message_reaction_updated', {
                    messageId,
                    reactions: cleaned.reactions
                });
            }
        } catch(e) { console.error('remove_reaction error', e); }
    });
    // ======= END GROUP CHAT EVENTS =======

    socket.on('disconnect', async () => {
      if (socket.user) await User.findByIdAndUpdate(socket.user._id, { socket_id: null });
    });
  });

  console.log('Socket.io initialized with Event Handlers');
  return io;
};

const getIO = () => { if (!io) throw new Error('Socket.io not initialized'); return io; };
const emitToUser = (userId, event, data) => io.to(`user:${userId}`).emit(event, data);
const emitToProject = (projectId, event, data) => io.to(`project:${projectId}`).emit(event, data);

module.exports = { initializeSocket, getIO, emitToUser, emitToProject };

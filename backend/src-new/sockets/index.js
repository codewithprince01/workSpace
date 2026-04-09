const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const constants = require('../config/constants');
const { User, Task, Project, TaskStatus, TeamMember, ProjectMember, TimeLog, RunningTimer, ActivityLog, TaskLabel, TaskPhase } = require('../models');
const SocketEvents = require('../config/socket-events');

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
        } = data;
        
        console.log('📝 Parsed task data:', { name, project_id, reporter_id, end_date });
        
        if (!name || !project_id) {
          console.log('❌ Missing required fields: name or project_id');
          return;
        }
        
        // 1. Resolve status (respect requested status when valid)
        let status_id = null;

        if (requestedStatusId) {
          const requestedStatus = await TaskStatus.findOne({
            _id: requestedStatusId,
            project_id,
          });
          if (requestedStatus) {
            status_id = requestedStatus._id;
          }
        }

        if (!status_id) {
          const defaultStatus = await TaskStatus.findOne({ project_id, is_default: true });
          if (defaultStatus) {
            status_id = defaultStatus._id;
          } else {
            const firstStatus = await TaskStatus.findOne({ project_id }).sort({ sort_order: 1 });
            if (firstStatus) {
              status_id = firstStatus._id;
            } else {
              const newStatus = await TaskStatus.create({
                project_id,
                name: 'To Do',
                category: 'todo',
                color_code: '#87d068',
                sort_order: 0,
                is_default: true
              });
              status_id = newStatus._id;
            }
          }
        }

        // 2. Resolve priority
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        let resolvedPriority = 'medium';
        const incomingPriority = requestedPriorityId || requestedPriority;
        if (typeof incomingPriority === 'string') {
          const normalizedPriority = incomingPriority.toLowerCase();
          if (validPriorities.includes(normalizedPriority)) {
            resolvedPriority = normalizedPriority;
          }
        }

        // 3. Resolve phase (optional)
        let resolvedPhaseId = null;
        if (requestedPhaseId) {
          const phase = await TaskPhase.findOne({ _id: requestedPhaseId, project_id });
          if (phase) {
            resolvedPhaseId = phase._id;
          }
        }
        
        console.log('📝 Using status_id:', status_id);
        
        // 4. Create Task
        const task = await Task.create({
            name,
            description: description || '',
            project_id,
            status_id,
            phase_id: resolvedPhaseId,
            reporter_id: reporter_id || socket.user._id,
            end_date: end_date ? new Date(end_date) : undefined,
            start_date: start_date ? new Date(start_date) : new Date(),
            priority: resolvedPriority
        });
        
        console.log('✅ Task created:', task._id);
        
        // Populate for response
        const populatedTask = await Task.findById(task._id)
            .populate('project_id', 'name key color_code')
            .populate('status_id', 'name color_code category')
            .populate('phase_id', 'name color_code');

        const taskObj = populatedTask.toObject();
        taskObj.id = task._id;
        taskObj.status = populatedTask.status_id?._id?.toString() || null;
        taskObj.status_id = populatedTask.status_id?._id?.toString() || null;
        taskObj.status_name = populatedTask.status_id?.name || null;
        taskObj.priority = task.priority || 'medium';
        taskObj.priority_id = task.priority || 'medium';
        taskObj.phase_id = populatedTask.phase_id?._id?.toString() || null;
        taskObj.phase_name = populatedTask.phase_id?.name || null;
        taskObj.phase_color = populatedTask.phase_id?.color_code || null;
        if (populatedTask.project_id) {
           taskObj.project_name = populatedTask.project_id.name;
           taskObj.project_color = populatedTask.project_id.color_code;
        } 
        taskObj.assignees = [];

        // Emit back to creator (ack)
        socket.emit(SocketEvents.QUICK_TASK.toString(), taskObj);
        
        // Create Activity Log
        await ActivityLog.create({
            task_id: task._id,
            project_id: project_id,
            done_by: socket.user?._id,
            log_type: 'create',
            log_text: `created the task: ${name}`,
            attribute_type: 'CREATE'
        });

        // Broadcast to everyone else in the project room (exclude creator to avoid duplicate event)
        socket.to(`project:${project_id}`).emit(SocketEvents.QUICK_TASK.toString(), taskObj);
        
      } catch (error) {
        console.error('❌ Socket QUICK_TASK error:', error);
      }
    });

    // QUICK_ASSIGNEES_UPDATE (Update Assignees)
    socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), async (jsonString) => {
       console.log('👥 QUICK_ASSIGNEES_UPDATE received:', jsonString);
       try {
         const data = JSON.parse(jsonString);
         const { task_id, team_member_id, project_id, mode, parent_task } = data;
         
         if (!task_id || !team_member_id) {
           console.log('❌ Missing task_id or team_member_id');
           return;
         }

         // Get the team member to find their user_id
         const teamMember = await TeamMember.findById(team_member_id).populate('user_id', 'name email avatar_url');
         if (!teamMember || !teamMember.user_id) {
           console.log('❌ Team member not found:', team_member_id);
           return;
         }

         const userId = teamMember.user_id._id;
         let task;

         if (mode === 0) {
           // Add assignee
           task = await Task.findByIdAndUpdate(
             task_id,
             { $addToSet: { assignees: userId } },
             { new: true }
           ).populate('assignees', 'name email avatar_url');
           console.log('✅ Added assignee:', teamMember.user_id.name);
         } else if (mode === 1) {
           // Remove assignee
           task = await Task.findByIdAndUpdate(
             task_id,
             { $pull: { assignees: userId } },
             { new: true }
           ).populate('assignees', 'name email avatar_url');
           console.log('✅ Removed assignee:', teamMember.user_id.name);
         } else {
           // Default to add if mode not specified
           task = await Task.findByIdAndUpdate(
             task_id,
             { $addToSet: { assignees: userId } },
             { new: true }
           ).populate('assignees', 'name email avatar_url');
         }

         if (!task) {
           console.log('❌ Task not found:', task_id);
           return;
         }

         // Create Activity Log
         try {
           await ActivityLog.create({
             task_id,
             project_id: task.project_id,
             done_by: socket.user._id,
             log_type: 'assignee',
             attribute_type: 'ASSIGNEES',
             log_text: mode === 1 ? `removed ${teamMember.user_id.name} from task` : `assigned ${teamMember.user_id.name} to task`
           });
         } catch (logError) {
           console.log('Activity log creation failed:', logError.message);
         }

         // Prepare response with assignee data matching frontend expectations
         const assignees = task.assignees?.map(a => ({
           team_member_id: team_member_id, // Keep consistent with frontend
           id: a._id.toString(),
           name: a.name,
           email: a.email,
           avatar_url: a.avatar_url
         })) || [];

         const response = {
           id: task_id,
           assignees: assignees,
           names: task.assignees?.map(a => ({
             team_member_id: team_member_id,
             name: a.name,
             avatar_url: a.avatar_url
           })) || [],
           parent_task: parent_task
         };
         
         console.log('✅ Assignees update response:', response);
         
         // Emit response back to sender
         socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), response);
         
         // Broadcast update to project room
         io.to(`project:${project_id}`).emit(SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), response);

       } catch (error) {
         console.error('❌ Socket QUICK_ASSIGNEES_UPDATE error:', error);
       }
    });
    
    // --- Other Events Handlers Needed? ---
    // TASK_NAME_CHANGE, etc. For now, focus on creation.
    socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), async (str) => {
        try {
            const data = JSON.parse(str);
            const { task_id, name } = data;
            await Task.findByIdAndUpdate(task_id, { name });
            const task = await Task.findById(task_id);
            if(task) {
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_NAME_CHANGE.toString(), {
                    id: task_id,
                    name: name
                });
            }
        } catch(e) {
            console.error('Socket TASK_NAME_CHANGE error:', e);
        }
    });

    // TASK_STATUS_CHANGE
    socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), async (str) => {
        console.log('📝 TASK_STATUS_CHANGE received:', str);
        try {
            const data = JSON.parse(str);
            const { task_id, status_id, team_id } = data;
            
            if (!task_id || !status_id) {
                console.log('❌ Missing task_id or status_id');
                return;
            }

            // Get original task for previous state
            const originalTask = await Task.findById(task_id).populate('status_id');
            const previousStatus = originalTask.status_id;
            
            // Update task status in database
            const task = await Task.findByIdAndUpdate(task_id, { status_id }, { new: true })
                .populate('status_id', 'name color_code category');
            
            if (task) {
                // Create Activity Log
                await ActivityLog.create({
                    task_id,
                    project_id: task.project_id,
                    done_by: socket.user._id,
                    log_type: 'status',
                    attribute_type: 'STATUS',
                    log_text: `changed status`,
                    previous_status: { name: previousStatus?.name, color_code: previousStatus?.color_code },
                    next_status: { name: task.status_id?.name, color_code: task.status_id?.color_code }
                });

                const response = {
                    id: task_id,
                    status_id: status_id,
                    color_code: task.status_id?.color_code,
                    statusCategory: task.status_id?.category,
                    complete_ratio: 0
                };
                
                console.log('✅ Status updated:', response);
                
                // Emit back to sender
                socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), response);
                
                // Broadcast to project
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_STATUS_CHANGE.toString(), response);
            }
        } catch(e) {
            console.error('❌ Socket TASK_STATUS_CHANGE error:', e);
        }
    });

    // TASK_PRIORITY_CHANGE
    socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), async (str) => {
        console.log('📝 TASK_PRIORITY_CHANGE received:', str);
        try {
            const data = JSON.parse(str);
            const { task_id, priority_id } = data;
            
            if (!task_id) {
                console.log('❌ Missing task_id');
                return;
            }

            // Handle both string IDs (low, medium, high, urgent) and numeric IDs (0, 1, 2, 3)
            let priority;
            const validPriorities = ['low', 'medium', 'high', 'urgent'];
            if (validPriorities.includes(priority_id)) {
                priority = priority_id;
            } else {
                const priorityMap = { 0: 'low', 1: 'medium', 2: 'high', 3: 'urgent' };
                priority = priorityMap[priority_id] || 'medium';
            }
            
            const originalTask = await Task.findById(task_id);
            
            const task = await Task.findByIdAndUpdate(task_id, { priority }, { new: true });
            
            if (task) {
                // Create Activity Log
                try {
                    await ActivityLog.create({
                        task_id,
                        project_id: task.project_id,
                        done_by: socket.user._id,
                        log_type: 'priority',
                        attribute_type: 'PRIORITY',
                        log_text: `changed priority from ${originalTask.priority} to ${priority}`
                    });
                } catch (logError) {
                    console.log('Activity log error:', logError.message);
                }

                const priorityColors = { low: '#87d068', medium: '#2db7f5', high: '#ff9800', urgent: '#f50' };
                const response = {
                    id: task_id,
                    priority_id: priority,  // The resolved priority name (low, medium, high, urgent)
                    priority: priority,
                    color_code: priorityColors[priority],
                    color_code_dark: priorityColors[priority]  // Same color for dark mode
                };
                
                console.log('✅ Priority updated:', response);
                
                socket.emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), response);
            }
        } catch(e) {
            console.error('❌ Socket TASK_PRIORITY_CHANGE error:', e);
        }
    });

    // TASK_PHASE_CHANGE
    socket.on(SocketEvents.TASK_PHASE_CHANGE.toString(), async (str) => {
        console.log('📝 TASK_PHASE_CHANGE received:', str);
        try {
            const data = JSON.parse(str);
            const { task_id, phase_id } = data;
            
            if (!task_id) {
                console.log('❌ Missing task_id');
                return;
            }

            const originalTask = await Task.findById(task_id).populate('phase_id');
            
            const updateData = phase_id ? { phase_id } : { phase_id: null };
            const task = await Task.findByIdAndUpdate(task_id, updateData, { new: true })
                .populate('phase_id', 'name color_code');
            
            if (task) {
                // Create Activity Log
                try {
                    await ActivityLog.create({
                        task_id,
                        project_id: task.project_id,
                        done_by: socket.user._id,
                        log_type: 'phase',
                        attribute_type: 'PHASE',
                        log_text: `changed phase`
                    });
                } catch (logError) {
                    console.log('Activity log error:', logError.message);
                }

                const response = {
                    id: task_id,
                    phase_id: phase_id,
                    phase_name: task.phase_id?.name,
                    phase_color: task.phase_id?.color_code
                };
                
                console.log('✅ Phase updated:', response);
                
                socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_PHASE_CHANGE.toString(), response);
            }
        } catch(e) {
            console.error('❌ Socket TASK_PHASE_CHANGE error:', e);
        }
    });

    // TASK_LABELS_CHANGE
    socket.on(SocketEvents.TASK_LABELS_CHANGE.toString(), async (str) => {
        console.log('📝 TASK_LABELS_CHANGE received:', str);
        try {
            const data = JSON.parse(str);
            const { task_id, label_id, is_selected } = data;
            
            if (!task_id || !label_id) {
                console.log('❌ Missing task_id or label_id');
                return;
            }

            let task;
            if (is_selected) {
                // Add label
                task = await Task.findByIdAndUpdate(
                    task_id, 
                    { $addToSet: { labels: label_id } }, 
                    { new: true }
                ).populate('labels', 'name color_code');
            } else {
                // Remove label
                task = await Task.findByIdAndUpdate(
                    task_id, 
                    { $pull: { labels: label_id } }, 
                    { new: true }
                ).populate('labels', 'name color_code');
            }
            
            if (task) {
                // Create Activity Log
                try {
                    const label = await TaskLabel.findById(label_id);
                    await ActivityLog.create({
                        task_id,
                        project_id: task.project_id,
                        done_by: socket.user._id,
                        log_type: 'label',
                        attribute_type: 'LABELS',
                        log_text: is_selected ? `added label "${label?.name}"` : `removed label "${label?.name}"`
                    });
                } catch (logError) {
                    console.log('Activity log error:', logError.message);
                }

                const response = {
                    id: task_id,
                    label_id: label_id,
                    is_selected: is_selected,
                    labels: task.labels?.map(l => ({
                        id: l._id.toString(),
                        name: l.name,
                        color_code: l.color_code
                    })) || []
                };
                
                console.log('✅ Labels updated:', response);
                
                socket.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_LABELS_CHANGE.toString(), response);
            }
        } catch(e) {
            console.error('❌ Socket TASK_LABELS_CHANGE error:', e);
        }
    });

    // UPDATE_TASK_PROGRESS
    socket.on(SocketEvents.UPDATE_TASK_PROGRESS.toString(), async (str) => {
        console.log('📝 UPDATE_TASK_PROGRESS received:', str);
        try {
            const data = JSON.parse(str);
            const { task_id, progress } = data;
            
            if (!task_id || progress === undefined) {
                console.log('❌ Missing task_id or progress');
                return;
            }

            const progressValue = Math.min(100, Math.max(0, parseInt(progress) || 0));
            
            const task = await Task.findByIdAndUpdate(
                task_id, 
                { progress: progressValue }, 
                { new: true }
            );
            
            if (task) {
                const response = {
                    task_id: task_id,
                    progress_value: progressValue
                };
                
                console.log('✅ Progress updated:', response);
                
                socket.emit(SocketEvents.TASK_PROGRESS_UPDATED.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_PROGRESS_UPDATED.toString(), response);
            }
        } catch(e) {
            console.error('❌ Socket UPDATE_TASK_PROGRESS error:', e);
        }
    });

    // TASK_START_DATE_CHANGE
    socket.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), async (str) => {
        console.log('📝 TASK_START_DATE_CHANGE received:', str);
        try {
            const data = JSON.parse(str);
            const { task_id, start_date } = data;
            
            if (!task_id) {
                console.log('❌ Missing task_id');
                return;
            }
            
            const updateData = start_date ? { start_date: new Date(start_date) } : { start_date: null };
            const task = await Task.findByIdAndUpdate(task_id, updateData, { new: true });
            
            if (task) {
                const response = {
                    id: task_id,
                    start_date: task.start_date
                };
                
                console.log('✅ Start date updated:', response);
                
                socket.emit(SocketEvents.TASK_START_DATE_CHANGE.toString(), response);
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_START_DATE_CHANGE.toString(), response);
            }
        } catch(e) {
            console.error('❌ Socket TASK_START_DATE_CHANGE error:', e);
        }
    });

    // TASK_END_DATE_CHANGE (Due Date)
    socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), async (str) => {
        console.log('📝 TASK_END_DATE_CHANGE received:', str);
        try {
            const data = JSON.parse(str);
            const { task_id, end_date } = data;
            
            if (!task_id) {
                console.log('❌ Missing task_id');
                return;
            }
            
            const originalTask = await Task.findById(task_id);

            // Update task end_date in database
            const updateData = end_date ? { end_date: new Date(end_date) } : { end_date: null };
            const task = await Task.findByIdAndUpdate(task_id, updateData, { new: true });
            
            if (task) {
                // Create Activity Log
                await ActivityLog.create({
                    task_id,
                    project_id: task.project_id,
                    done_by: socket.user._id,
                    log_type: 'update',
                    attribute_type: 'DATE',
                    log_text: `changed due date`,
                    previous: originalTask.end_date,
                    current: task.end_date
                });

                const response = {
                    id: task_id,
                    end_date: task.end_date
                };
                
                console.log('✅ End date updated:', response);
                
                // Emit back to sender
                socket.emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), response);
                
                // Broadcast to project
                io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), response);
            }
        } catch(e) {
            console.error('❌ Socket TASK_END_DATE_CHANGE error:', e);
        }
    });
    
    // TASK_TIMER_START
    socket.on(SocketEvents.TASK_TIMER_START.toString(), async (str) => {
        console.log('⏱️ TASK_TIMER_START received:', str);
        try {
            const data = JSON.parse(str);
            const { task_id } = data;
            
            if (!task_id) return;
            
            const task = await Task.findById(task_id);
            if (!task) return;

            // Clear any existing timer for this user (one active timer rule)
            await RunningTimer.deleteMany({ user_id: socket.user._id });

            const startTime = new Date();
            const runningTimer = await RunningTimer.create({
                task_id,
                user_id: socket.user._id,
                project_id: task.project_id,
                start_time: startTime
            });

            const response = {
                task_id,
                start_time: startTime.getTime(), // Return as numeric timestamp (milliseconds)
                user_id: socket.user._id.toString()
            };
            
            console.log('✅ Timer started:', response);
            
            // Emit back to sender
            socket.emit(SocketEvents.TASK_TIMER_START.toString(), response);
            
            // Broadcast to project
            io.to(`project:${task.project_id}`).emit(SocketEvents.TASK_TIMER_START.toString(), {
                ...response,
                user_name: socket.user.name,
                avatar_url: socket.user.avatar_url
            });

        } catch(e) {
            console.error('❌ Socket TASK_TIMER_START error:', e);
        }
    });

    // TASK_TIMER_STOP
    socket.on(SocketEvents.TASK_TIMER_STOP.toString(), async (str) => {
        console.log('🛑 TASK_TIMER_STOP received:', str);
        try {
            const data = JSON.parse(str);
            const { task_id, description } = data;
            
            // Find running timer for this user (and task)
            const runningTimer = await RunningTimer.findOne({ user_id: socket.user._id, task_id });
            
            if (runningTimer) {
                const endTime = new Date();
                const startTime = new Date(runningTimer.start_time);
                
                // Diff in hours
                const diffMs = endTime - startTime;
                const hours = diffMs / (1000 * 60 * 60); 
                
                console.log(`⏱️ Timer stopped. Duration: ${hours.toFixed(2)} hours (${Math.round(diffMs/1000)} seconds)`);
                
                // Create TimeLog (only if more than a few seconds)
                // Create TimeLog always
                if (diffMs > 0) {
                     await TimeLog.create({
                        task_id,
                        user_id: socket.user._id,
                        hours: hours,
                        description: description || '',
                        logged_date: endTime
                    });
                }
                
                // Remove running timer
                await RunningTimer.deleteOne({ _id: runningTimer._id });
                
                const response = {
                    task_id,
                    user_id: socket.user._id.toString(),
                    duration_hours: hours};
                
                console.log('✅ Timer stopped, time logged:', response);
                
                socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), response);
                
                // Broadcast to project
                io.to(`project:${runningTimer.project_id}`).emit(SocketEvents.TASK_TIMER_STOP.toString(), {
                    ...response,
                    user_name: socket.user.name
                });
            } else {
                console.log('⚠️ No running timer found for task:', task_id);
                // Still emit stop to clean up frontend state
                socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), { task_id });
            }

        } catch(e) {
            console.error('❌ Socket TASK_TIMER_STOP error:', e);
        }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      // console.log(`Client disconnected: ${socket.id}`);
      if (socket.user) {
        await User.findByIdAndUpdate(socket.user._id, { socket_id: null });
      }
    });
  });

  console.log('Socket.io initialized with Event Handlers');
  return io;
};

/**
 * Get Socket.io instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

/**
 * Emit to specific user
 */
const emitToUser = (userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit to project room
 */
const emitToProject = (projectId, event, data) => {
  io.to(`project:${projectId}`).emit(event, data);
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToProject
};

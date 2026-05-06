const { Todo, User, TeamMember, TodoComment } = require('../models');
const mongoose = require('mongoose');

/**
 * @desc    Get todos with advanced filtering
 * @route   GET /api/todos
 */
const formatTodo = (todo) => {
  const t = todo.toObject({ virtuals: true });
  
  let performance = null;
  if (t.status === 'completed' && t.due_date && t.completed_at) {
    const onTime = new Date(t.completed_at) <= new Date(t.due_date);
    const daysToComplete = Math.ceil((new Date(t.completed_at) - new Date(t.created_at)) / (1000 * 60 * 60 * 24));
    const overdueDays = onTime ? 0 : Math.ceil((new Date(t.completed_at) - new Date(t.due_date)) / (1000 * 60 * 60 * 24));
    
    performance = {
      on_time: onTime,
      days_taken: daysToComplete,
      overdue_days: overdueDays
    };
  }

  return { ...t, performance };
};

/**
 * @desc    Get todos with advanced filtering
 * @route   GET /api/todos
 */
exports.getTodos = async (req, res, next) => {
  try {
    const { view = 'my', status, priority, search } = req.query;
    const userId = req.user._id;

    console.log(`[TodoAPI] getTodos - User: ${req.user.email} | Params:`, { view, status, priority, search });

    let query = {};

    // Feature 3 & 11: View Switcher & Visibility Rules
    if (view === 'assigned') {
      query.assigned_to = userId;
    } else {
      query.created_by = userId;
    }

    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const todos = await Todo.find(query)
      .populate('created_by', 'name email avatar_url')
      .populate('assigned_to', 'name email avatar_url')
      .sort({ updated_at: -1 });

    // Transform for performance tracking (Feature 8)
    const formatted = todos.map(todo => formatTodo(todo));

    res.json({ done: true, body: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new todo
 * @route   POST /api/todos
 */
exports.createTodo = async (req, res, next) => {
  try {
    const { title, description, assigned_to, due_date, priority, labels } = req.body;

    const todo = await Todo.create({
      title,
      description,
      assigned_to: assigned_to || [],
      due_date: due_date || null,
      priority: priority || 'medium',
      labels: labels || [],
      created_by: req.user._id,
      status: 'pending',
      progress: 0
    });

    const populated = await Todo.findById(todo._id)
      .populate('created_by', 'name email avatar_url')
      .populate('assigned_to', 'name email avatar_url');

    res.status(201).json({ done: true, body: formatTodo(populated) });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update todo (status, progress, lifecycle)
 * @route   PUT /api/todos/:id
 */
exports.updateTodo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`[TodoAPI] updateTodo - ID: ${id} | Updates:`, updates);

    // Feature 5: Progress & Status logic
    if (updates.status === 'completed' || updates.progress === 100) {
      updates.status = 'completed';
      updates.progress = 100;
      updates.completed_at = updates.completed_at || new Date();
    } else if (updates.status || updates.progress !== undefined) {
      // If moving away from completed, reset completed_at
      updates.completed_at = null;
      // If status changed to in-progress but progress is still 100, reset progress to a reasonable value or 0
      if (updates.progress === 100) {
          updates.progress = 0; // Or keep as is if user specifically wants 100% progress without completion (unlikely for todos)
      }
    }

    let filter = { _id: id };
    if (!req.user.is_super_admin) {
        filter.$or = [{ created_by: req.user._id }, { assigned_to: req.user._id }];
    }

    const todo = await Todo.findOneAndUpdate(
      filter,
      { $set: updates },
      { new: true }
    )
    .populate('created_by', 'name email avatar_url')
    .populate('assigned_to', 'name email avatar_url');

    if (!todo) return res.status(404).json({ done: false, message: 'Todo not found or unauthorized' });

    console.log(`[TodoAPI] updateTodo Success - New due_date: ${todo.due_date}`);

    res.json({ done: true, body: formatTodo(todo) });
  } catch (error) {
    console.error(`[TodoAPI] updateTodo Error:`, error);
    next(error);
  }
};

/**
 * @desc    Bulk update todos
 * @route   POST /api/todos/bulk-update
 */
exports.bulkUpdate = async (req, res, next) => {
    try {
        const { ids, data } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ done: false, message: 'IDs must be an array' });
        }

        let filter = { _id: { $in: ids } };
        if (!req.user.is_super_admin) {
            filter.$or = [{ created_by: req.user._id }, { assigned_to: req.user._id }];
        }

        // Apply same status/progress logic as single update
        if (data.status === 'completed' || data.progress === 100) {
            data.status = 'completed';
            data.progress = 100;
            data.completed_at = new Date();
        } else if (data.status || data.progress !== undefined) {
            data.completed_at = null;
        }

        await Todo.updateMany(filter, { $set: data });

        res.json({ done: true, message: 'Todos updated' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete todo
 * @route   DELETE /api/todos/:id
 */
exports.deleteTodo = async (req, res, next) => {
  try {
    const { id } = req.params;
    let filter = { _id: id };
    
    if (!req.user.is_super_admin) {
        filter.created_by = req.user._id;
    }

    const todo = await Todo.findOneAndDelete(filter);

    if (!todo) return res.status(404).json({ done: false, message: 'Todo not found or unauthorized' });

    res.json({ done: true, message: 'Todo deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk delete todos
 * @route   POST /api/todos/bulk-delete
 */
exports.bulkDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ done: false, message: 'IDs must be an array' });
    }

    let filter = { _id: { $in: ids } };
    
    // If not super admin, only allow deleting own todos
    if (!req.user.is_super_admin) {
        filter.created_by = req.user._id;
    }

    await Todo.deleteMany(filter);

    res.json({ done: true, message: 'Todos deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search users for assignment (Team members + Global)
 * @route   GET /api/todos/search-users
 */
exports.memberSearch = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    
    // 1. Allow all users to search the global directory as requested
    console.log(`[TodoMemberSearch] User ${req.user.email} searching global directory`);

    // 2. Build query
    let searchFilter = {};
    if (q) {
      const re = { $regex: q, $options: 'i' };
      searchFilter.$or = [{ name: re }, { email: re }];
    }

    // 3. Fetch matching users
    const users = await User.find(searchFilter)
      .select('name email avatar_url department')
      .sort({ name: 1 })
      .limit(100)
      .lean();

    console.log(`[TodoMemberSearch] Returning ${users.length} users for query: "${q}"`);

    // Force no cache at all levels
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.removeHeader('ETag');

    res.json({ 
      done: true, 
      body: users,
      _timestamp: Date.now() // Force body change to break ETag if still present
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get comments for a todo
 * @route   GET /api/todos/:id/comments
 */
exports.getComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const comments = await TodoComment.find({ todo_id: id })
      .populate('author', 'name email avatar_url')
      .sort({ created_at: 1 });
    res.json({ done: true, body: comments });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a comment to a todo
 * @route   POST /api/todos/:id/comments
 */
exports.addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ done: false, message: 'Comment content is required' });
    }
    const comment = await TodoComment.create({
      todo_id: id,
      author: req.user._id,
      content: content.trim()
    });
    const populated = await TodoComment.findById(comment._id)
      .populate('author', 'name email avatar_url');
    res.status(201).json({ done: true, body: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a comment
 * @route   DELETE /api/todos/:todoId/comments/:commentId
 */
exports.deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    let filter = { _id: commentId };
    if (!req.user.is_super_admin) {
      filter.author = req.user._id;
    }
    const comment = await TodoComment.findOneAndDelete(filter);
    if (!comment) return res.status(404).json({ done: false, message: 'Comment not found or unauthorized' });
    res.json({ done: true, message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
};

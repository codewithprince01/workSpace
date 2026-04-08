const { User } = require('../models');

/**
 * @desc    Get all users (admin)
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getAll = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    
    const query = { is_active: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ created_at: -1 });
    
    const total = await User.countDocuments(query);
    
    res.json({
      done: true,
      body: {
        data: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user
 * @route   GET /api/users/:id
 * @access  Private
 */
exports.getById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        done: false,
        message: 'User not found'
      });
    }
    
    res.json({
      done: true,
      body: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/:id
 * @access  Private
 */
exports.update = async (req, res, next) => {
  try {
    const { name, avatar_url, timezone } = req.body;
    
    // Only allow users to update their own profile (unless admin)
    if (req.params.id !== req.user._id.toString() && !req.user.is_admin) {
      return res.status(403).json({
        done: false,
        message: 'Not authorized to update this user'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        done: false,
        message: 'User not found'
      });
    }
    
    if (name) user.name = name;
    if (avatar_url) user.avatar_url = avatar_url;
    if (timezone) user.timezone = timezone;
    
    await user.save();
    
    res.json({
      done: true,
      body: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search users
 * @route   GET /api/users/search
 * @access  Private
 */
exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        done: true,
        body: []
      });
    }
    
    const users = await User.find({
      is_active: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    })
      .select('name email avatar_url')
      .limit(10);
    
    res.json({
      done: true,
      body: users
    });
  } catch (error) {
    next(error);
  }
};

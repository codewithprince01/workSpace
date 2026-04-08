const { TaskPhase } = require('../models');

// GET /api/task-phases?id=:projectId
exports.getAll = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ done: false, message: 'Project ID is required' });
        }

        const phases = await TaskPhase.find({ project_id: id }).sort({ sort_order: 1 });
        
        res.json({
            done: true,
            body: phases
        });
    } catch (error) {
        console.error('Get phases error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch task phases' });
    }
};

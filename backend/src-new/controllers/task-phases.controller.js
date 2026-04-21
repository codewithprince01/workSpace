const { TaskPhase } = require('../models');

// GET /api/task-phases?id=:projectId
exports.getAll = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ done: false, message: 'Project ID is required' });
        }

        const phases = await TaskPhase.find({ project_id: id }).sort({ sort_order: 1 });
        
        // Map _id to id for frontend compatibility
        const formattedPhases = phases.map(phase => ({
            ...phase.toObject(),
            id: phase._id.toString()
        }));

        res.json({
            done: true,
            body: formattedPhases
        });
    } catch (error) {
        console.error('Get phases error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch task phases' });
    }
};

// POST /api/task-phases
exports.create = async (req, res) => {
    try {
        const { name, project_id, color_code } = req.body;
        // Also check query for project_id if body is empty (some legacy code might do this)
        const projectId = project_id || req.query.id || req.query.current_project_id;
        const phaseName = name || req.body.phase;

        if (!phaseName || !projectId) {
            return res.status(400).json({ done: false, message: 'Phase name and project ID are required' });
        }

        // Get max sort_order
        const lastPhase = await TaskPhase.findOne({ project_id: projectId }).sort({ sort_order: -1 });
        const nextSortOrder = lastPhase ? (lastPhase.sort_order || 0) + 1 : 0;

        const phase = new TaskPhase({
            name: phaseName,
            project_id: projectId,
            color_code: color_code || '#cccccc',
            sort_order: nextSortOrder
        });

        await phase.save();

        res.status(201).json({
            done: true,
            message: 'Phase created successfully',
            body: {
                ...phase.toObject(),
                id: phase._id.toString()
            }
        });
    } catch (error) {
        console.error('Create phase error:', error);
        res.status(500).json({ done: false, message: 'Failed to create task phase' });
    }
};

// PUT /api/task-phases/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color_code, sort_order } = req.body;

        if (!id || id === 'undefined') {
            return res.status(400).json({ done: false, message: 'Valid Phase ID is required' });
        }

        const phase = await TaskPhase.findByIdAndUpdate(
            id,
            { name, color_code, sort_order },
            { new: true }
        );

        if (!phase) {
            return res.status(404).json({ done: false, message: 'Phase not found' });
        }

        res.json({
            done: true,
            message: 'Phase updated successfully',
            body: {
                ...phase.toObject(),
                id: phase._id.toString()
            }
        });
    } catch (error) {
        console.error('Update phase error:', error);
        res.status(500).json({ done: false, message: 'Failed to update task phase' });
    }
};

// DELETE /api/task-phases/:id
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || id === 'undefined') {
            return res.status(400).json({ done: false, message: 'Valid Phase ID is required' });
        }

        const phase = await TaskPhase.findByIdAndDelete(id);

        if (!phase) {
            return res.status(404).json({ done: false, message: 'Phase not found' });
        }

        res.json({
            done: true,
            message: 'Phase deleted successfully'
        });
    } catch (error) {
        console.error('Delete phase error:', error);
        res.status(500).json({ done: false, message: 'Failed to delete task phase' });
    }
};

// PUT /api/task-phases/label/:projectId
exports.updateLabel = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, name, phase_label } = req.body;
        const finalLabel = label || name || phase_label;

        if (!finalLabel) {
            return res.status(400).json({ done: false, message: 'Label is required' });
        }

        const { Project } = require('../models');
        const project = await Project.findByIdAndUpdate(
            id,
            { phase_label: finalLabel },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({ done: false, message: 'Project not found' });
        }

        res.json({
            done: true,
            message: 'Phase label updated successfully',
            body: { phase_label: label }
        });
    } catch (error) {
        console.error('Update phase label error:', error);
        res.status(500).json({ done: false, message: 'Failed to update phase label' });
    }
};

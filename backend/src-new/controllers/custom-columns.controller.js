const { CustomColumn, Task, Project } = require('../models');

// GET /api/v1/custom-columns/project/:projectId/columns
exports.getProjectColumns = async (req, res) => {
    try {
        const { projectId } = req.params;
        const columns = await CustomColumn.find({ project_id: projectId }).sort({ created_at: 1 });
        res.json({ done: true, body: columns });
    } catch (error) {
        console.error('Get custom columns error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch custom columns' });
    }
};

// POST /api/v1/custom-columns
exports.create = async (req, res) => {
    try {
        const { project_id, name, key, field_type, width, is_visible, configuration } = req.body;
        
        const column = await CustomColumn.create({
            project_id,
            name,
            key,
            field_type,
            width,
            is_visible,
            configuration
        });

        res.status(201).json({ done: true, body: column });
    } catch (error) {
        console.error('Create custom column error:', error);
        res.status(500).json({ done: false, message: 'Failed to create custom column' });
    }
};

// PUT /api/v1/custom-columns/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, field_type, width, is_visible, configuration } = req.body;
        
        console.log('>>> UPDATING COLUMN:', id, 'WITH DATA:', req.body);

        const mongoose = require('mongoose');
        const query = mongoose.Types.ObjectId.isValid(id) 
            ? { _id: id } 
            : { key: id };

        const column = await CustomColumn.findOneAndUpdate(
            query,
            { name, field_type, width, is_visible, configuration },
            { new: true }
        );

        if (!column) {
            console.log('>>> COLUMN NOT FOUND FOR QUERY:', query);
            return res.status(404).json({ done: false, message: 'Custom column not found' });
        }

        res.json({ done: true, body: column });
    } catch (error) {
        console.error('Update custom column error:', error);
        res.status(500).json({ 
            done: false, 
            message: 'Failed to update custom column',
            error: error.message,
            stack: error.stack
        });
    }
};

// DELETE /api/v1/custom-columns/:id
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const mongoose = require('mongoose');
        const query = mongoose.Types.ObjectId.isValid(id) 
            ? { _id: id } 
            : { key: id };

        const column = await CustomColumn.findOneAndDelete(query);
        if (!column) {
            return res.status(404).json({ done: false, message: 'Custom column not found' });
        }
        res.json({ done: true, body: {} });
    } catch (error) {
        console.error('Delete custom column error:', error);
        res.status(500).json({ done: false, message: 'Failed to delete custom column' });
    }
};

// PUT /api/v1/custom-columns/project/:projectId/columns (Update visibility/batch update)
exports.updateVisibility = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { pinned, width, id: bodyId } = req.body;
        const id = req.params.id || bodyId;
        
        if (!id) {
            return res.status(400).json({ done: false, message: 'Column ID is required' });
        }
        
        const mongoose = require('mongoose');
        const query = mongoose.Types.ObjectId.isValid(id) 
            ? { _id: id } 
            : { key: id };
        
        const update = {};
        if (typeof pinned !== 'undefined') {
            update.pinned = pinned;
            update.is_visible = pinned;
        }
        if (width) update.width = parseFloat(width);
        
        const column = await CustomColumn.findOneAndUpdate(query, update, { new: true });

        res.json({ done: true, body: column });
    } catch (error) {
         console.error('Update visibility error:', error);
         res.status(500).json({ 
             done: false, 
             message: 'Failed to update column',
             error: error.message 
         });
    }
};

// PUT /api/v1/tasks/:taskId/custom-column
exports.updateTaskValue = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { column_key, value } = req.body;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ done: false, message: 'Task not found' });
        }

        // Initialize custom_column_values if undefined
        if (!task.custom_column_values) {
            task.custom_column_values = {};
        }

        // Mongoose Mixed type requires markModified for nested updates
        task.custom_column_values[column_key] = value;
        task.markModified('custom_column_values');
        
        await task.save();

        res.json({ done: true, body: task });
    } catch (error) {
        console.error('Update task custom column error:', error);
        res.status(500).json({ done: false, message: 'Failed to update task value' });
    }
};

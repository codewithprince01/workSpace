const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todo.controller');
const { protect } = require('../middlewares/auth.middleware');

// All routes are protected
router.use(protect);

router.get('/', todoController.getTodos);
router.post('/', todoController.createTodo);
router.get('/member-search', todoController.memberSearch);
router.post('/bulk-delete', todoController.bulkDelete);
router.post('/bulk-update', todoController.bulkUpdate);

router.put('/:id', todoController.updateTodo);
router.delete('/:id', todoController.deleteTodo);

// Comment routes
router.get('/:id/comments', todoController.getComments);
router.post('/:id/comments', todoController.addComment);
router.delete('/:todoId/comments/:commentId', todoController.deleteComment);

module.exports = router;

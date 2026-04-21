const express = require('express');
const router = express.Router();
const controller = require('../controllers/task-phases.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/label/:id', controller.updateLabel);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;

const express = require('express');
const router = express.Router();
const { users } = require('../controllers');
const { protect } = require('../middlewares/auth.middleware');
const { commonValidators } = require('../middlewares/validation.middleware');

router.use(protect);

router.get('/', users.getAll);
router.get('/search', users.search);

router.route('/:id')
  .get(commonValidators.mongoId, users.getById)
  .put(commonValidators.mongoId, users.update);

module.exports = router;

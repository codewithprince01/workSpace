const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

// GET /api/job-titles
router.get('/', (req, res) => {
  const jobTitles = [
    { id: '1', name: 'Software Engineer' },
    { id: '2', name: 'Product Manager' },
    { id: '3', name: 'Designer' },
    { id: '4', name: 'QA Engineer' },
    { id: '5', name: 'DevOps Engineer' },
    { id: '6', name: 'Manager' },
    { id: '7', name: 'Director' },
    { id: '8', name: 'VP' },
    { id: '9', name: 'CEO' },
    { id: '10', name: 'Other' }
  ];

  const search = req.query.search?.toLowerCase();
  const filtered = search 
    ? jobTitles.filter(j => j.name.toLowerCase().includes(search))
    : jobTitles;

  res.json({
    done: true,
    body: {
        data: filtered,
        total: filtered.length
    }
  });
});

module.exports = router;

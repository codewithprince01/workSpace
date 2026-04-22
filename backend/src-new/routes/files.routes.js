const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { StoredFile } = require('../models');

router.use(protect);

router.get('/by-key/:fileKey', async (req, res) => {
  try {
    const fileKey = decodeURIComponent(req.params.fileKey || '');
    if (!fileKey) {
      return res.status(400).json({ done: false, message: 'file key is required' });
    }

    const storedFile = await StoredFile.findOne({ file_key: fileKey });
    if (!storedFile) {
      return res.status(404).json({ done: false, message: 'File not found' });
    }

    res.setHeader('Content-Type', storedFile.file_type || 'application/octet-stream');
    res.setHeader('Content-Length', storedFile.file_data?.length || 0);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(storedFile.file_data);
  } catch (error) {
    return res.status(500).json({ done: false, message: 'Failed to fetch file' });
  }
});

module.exports = router;


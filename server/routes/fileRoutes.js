import express from 'express';
import File from '../models/File.js';

const router = express.Router();

// Helper function to format date
const formatDate = (isoDate) => {
  const date = new Date(isoDate);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).replace(',', '');
};

// Create new file
router.post('/', async (req, res) => {
  try {
    const file = new File(req.body);
    await file.save();

    const formattedFile = {
      ...file._doc,
      createdAt: formatDate(file.createdAt)
    };

    res.json(formattedFile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all files with formatted createdAt
router.get('/', async (req, res) => {
  try {
    const files = await File.find();

    const formattedFiles = files.map(file => ({
      ...file._doc,
      createdAt: formatDate(file.createdAt)
    }));

    res.json(formattedFiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update file (e.g., mark as read) and return formatted result
router.put('/:id', async (req, res) => {
  try {
    const updated = await File.findByIdAndUpdate(req.params.id, req.body, { new: true });

    const formattedFile = {
      ...updated._doc,
      createdAt: formatDate(updated.createdAt)
    };

    res.json(formattedFile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

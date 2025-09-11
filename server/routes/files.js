// routes/files.js
import express from 'express';
import File from '../models/File.js';

const router = express.Router();

// GET specific file by ID
router.get('/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });
    res.json(file);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching file', error });
  }
});

router.post('/:id/delete-sheet', async (req, res) => {
        const { index } = req.body;
        try {
          const file = await File.findById(req.params.id);
          if (!file) return res.status(404).json({ message: "File not found" });
      
          file.downloadedSheets.splice(index, 1);
          await file.save();
      
          res.status(200).json({ message: "Entry deleted." });
        } catch (error) {
          res.status(500).json({ message: "Delete failed", error });
        }
      });
      

export default router;

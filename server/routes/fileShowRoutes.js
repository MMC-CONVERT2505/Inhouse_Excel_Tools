// routes/fileRoutes.js
import express from 'express';
import File from '../models/File.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// 🔐 Create new file for the logged-in user
router.post('/', protect, async (req, res) => {
  try {
    const { fileName, softwareType, countryName, currencyStatus } = req.body;
    const file = new File({
      user: req.user._id, // ✅ Associate with user
      fileName,
      softwareType,
      countryName,
      currencyStatus
    });
    const savedFile = await file.save();
    res.status(201).json(savedFile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔐 Get files of the logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const files = await File.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(files);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

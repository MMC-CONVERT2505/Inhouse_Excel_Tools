// routes/fileRoutes.js
import express from 'express';
import File from '../models/File.js';

const router = express.Router();

router.post('/files/:id/save-sheet', async (req, res) => {
  const { id } = req.params;
  const { sheetName, routeUsed } = req.body;

  if (!sheetName || !routeUsed) {
    return res.status(400).json({ message: "Missing sheetName or routeUsed" });
  }

  try {
    const file = await File.findById(id);
    if (!file) return res.status(404).json({ message: "File not found" });

    // Find existing route group
    const routeGroup = file.downloadedSheets.find(group => group.routeUsed === routeUsed);

    if (routeGroup) {
      // Append to existing route group
      routeGroup.sheets.push({
        sheetName,
        downloadedAt: new Date()
      });
    } else {
      // Create new route group
      file.downloadedSheets.push({
        routeUsed,
        sheets: [{
          sheetName,
          downloadedAt: new Date()
        }]
      });
    }

    await file.save();

    res.status(200).json({ message: "Sheet info saved successfully" });

  } catch (error) {
    console.error("Error saving sheet info:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

import express from 'express';
import User from '../models/User.js'; // Update path as needed
const router = express.Router();


router.get('/users', async (req, res) => {
  const users = await User.find({}, 'name email password');
  res.json(users);
});

// DELETE user by ID
router.delete('/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

export default router;

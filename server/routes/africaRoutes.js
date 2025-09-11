import { Router } from "express";
const router = Router();
import multer from "multer";
const upload = multer({ dest: "uploads/" });

import { uploadCoa, processCoa, downloadCoa } from "../controllers/africaControllers/chartOfAccount.js";
// Utility to wrap async route handlers and catch errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Upload routes
router.post("/upload-coa", upload.single("file"), asyncHandler(uploadCoa));

// Convert routes
router.post("/process-coa", asyncHandler(processCoa));

// Download routes
router.get("/download-coa", asyncHandler(downloadCoa));

export default router;
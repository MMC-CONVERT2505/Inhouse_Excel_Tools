import { Router } from "express";
const router = Router();
import multer from "multer";
const upload = multer({ dest: "uploads/" });

import { uploadCoa, processCoa, downloadCoa } from "../controllers/africaControllers/chartOfAccount.js";
import { uploadCustomer, processCustomer, downloadCustomer } from "../controllers/africaControllers/customer.js";
import { uploadSupplier, processSupplier, downloadSupplier } from "../controllers/africaControllers/supplier.js";
import { uploadItem, processItem, downloadItem } from "../controllers/africaControllers/item.js";

// Utility to wrap async route handlers and catch errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Upload routes
router.post("/upload-coa", upload.single("file"), asyncHandler(uploadCoa));
router.post("/upload-customer", upload.single("file"), asyncHandler(uploadCustomer));
router.post("/upload-supplier", upload.single("file"), asyncHandler(uploadSupplier));
router.post("/upload-item", upload.single("file"), asyncHandler(uploadItem));

// Convert routes
router.post("/process-coa", asyncHandler(processCoa));
router.post("/process-customer", asyncHandler(processCustomer));
router.post("/process-supplier", asyncHandler(processSupplier));
router.post("/process-item", asyncHandler(processItem));

// Download routes
router.get("/download-coa", asyncHandler(downloadCoa));
router.get("/download-customer", asyncHandler(downloadCustomer));
router.get("/download-supplier", asyncHandler(downloadSupplier));
router.get("/download-item", asyncHandler(downloadItem));

export default router;
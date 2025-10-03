import { Router } from "express";
const router = Router();
import multer from "multer";
const upload = multer({ dest: "uploads/" });

import { uploadCoa, processCoa, downloadCoa } from "../controllers/africaControllers/chartOfAccount.js";
import { uploadCustomer, processCustomer, downloadCustomer } from "../controllers/africaControllers/customer.js";
import { uploadSupplier, processSupplier, downloadSupplier } from "../controllers/africaControllers/supplier.js";
import { uploadItem, processItem, downloadItem } from "../controllers/africaControllers/item.js";
import { downloadOpenAR, processMultiCurrencyOpenAR, uploadOpenAR } from "../controllers/africaControllers/openAR.js";
import { downloadOpenAP, processMultiCurrencyOpenAP, uploadOpenAP } from "../controllers/africaControllers/openAP.js";
import { downloadInvoice, processMultiCurrencyInvoice, uploadInvoice } from "../controllers/africaControllers/invoice.js";
import { downloadAdjustmentNote, processMultiCurrencyAdjustment, uploadAdjustmentNote } from "../controllers/africaControllers/adjustmentNote.js";
import { downloadBill, processMultiCurrencyBill, uploadBill } from "../controllers/africaControllers/bill.js";
import { downloadSupplierCredit, processMultiCurrencySupplierCredit, uploadSupplierCredit } from "../controllers/africaControllers/suppliercredit.js";
import { downloadCheque, processMultiCurrencyCheque, uploadCheque } from "../controllers/africaControllers/cheque.js";
import { downloadDeposit, processMultiCurrencyDeposit, uploadDeposit } from "../controllers/africaControllers/deposit.js";
import { downloadJournal, processMultiCurrencyJournal, uploadJournal } from "../controllers/africaControllers/journal.js";
import { downloadCreditCardCharge, processMultiCurrencyCreditCardCharge, uploadCreditCardCharge } from "../controllers/africaControllers/creditCardCharge.js";
import { downloadTransfer, processTransfer, uploadTransfer } from "../controllers/africaControllers/transfer.js";
import { downloadBillPayment, processBillPayment, uploadBillPayment } from "../controllers/africaControllers/billPayment.js";
// Utility to wrap async route handlers and catch errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Upload routes
router.post("/upload-coa", upload.single("file"), asyncHandler(uploadCoa));
router.post("/upload-customer", upload.single("file"), asyncHandler(uploadCustomer));
router.post("/upload-supplier", upload.single("file"), asyncHandler(uploadSupplier));
router.post("/upload-item", upload.single("file"), asyncHandler(uploadItem));
router.post("/upload-openar", upload.single("file"), asyncHandler(uploadOpenAR));
router.post("/upload-openap", upload.single("file"), asyncHandler(uploadOpenAP));
router.post("/upload-invoice", upload.single("file"), asyncHandler(uploadInvoice));
router.post("/upload-adjustmentnote", upload.single("file"), asyncHandler(uploadAdjustmentNote));
router.post("/upload-bill", upload.single("file"), asyncHandler(uploadBill));
router.post("/upload-suppliercredit", upload.single("file"), asyncHandler(uploadSupplierCredit));
router.post("/upload-cheque", upload.single("file"), asyncHandler(uploadCheque));
router.post("/upload-deposit", upload.single("file"), asyncHandler(uploadDeposit));
router.post("/upload-journal", upload.single("file"), asyncHandler(uploadJournal));
router.post("/upload-creditcardcharge", upload.single("file"), asyncHandler(uploadCreditCardCharge));
router.post("/upload-transfer", upload.single("file"), asyncHandler(uploadTransfer));
router.post("/upload-billpayment", upload.single("file"), asyncHandler(uploadBillPayment));



// Convert routes
router.post("/process-coa", asyncHandler(processCoa));
router.post("/process-customer", asyncHandler(processCustomer));
router.post("/process-supplier", asyncHandler(processSupplier));
router.post("/process-item", asyncHandler(processItem));
router.post("/process-openar", asyncHandler(processMultiCurrencyOpenAR));
router.post("/process-openap", asyncHandler(processMultiCurrencyOpenAP));
router.post("/process-invoice", asyncHandler(processMultiCurrencyInvoice));
router.post("/process-adjustmentnote", asyncHandler(processMultiCurrencyAdjustment));
router.post("/process-bill", asyncHandler(processMultiCurrencyBill));
router.post("/process-suppliercredit", asyncHandler(processMultiCurrencySupplierCredit));
router.post("/process-cheque", asyncHandler(processMultiCurrencyCheque));
router.post("/process-deposit", asyncHandler(processMultiCurrencyDeposit));
router.post("/process-journal", asyncHandler(processMultiCurrencyJournal));
router.post("/process-creditcardcharge", asyncHandler(processMultiCurrencyCreditCardCharge));
router.post("/process-transfer", asyncHandler(processTransfer));
router.post("/process-billpayment", asyncHandler(processBillPayment));

// Download routes
router.get("/download-coa", asyncHandler(downloadCoa));
router.get("/download-customer", asyncHandler(downloadCustomer));
router.get("/download-supplier", asyncHandler(downloadSupplier));
router.get("/download-item", asyncHandler(downloadItem));
router.get("/download-openar", asyncHandler(downloadOpenAR));
router.get("/download-openap", asyncHandler(downloadOpenAP));
router.get("/download-invoice", asyncHandler(downloadInvoice));
router.get("/download-adjustmentnote", asyncHandler(downloadAdjustmentNote));
router.get("/download-bill", asyncHandler(downloadBill));
router.get("/download-suppliercredit", asyncHandler(downloadSupplierCredit));
router.get("/download-cheque", asyncHandler(downloadCheque));
router.get("/download-deposit", asyncHandler(downloadDeposit));
router.get("/download-journal", asyncHandler(downloadJournal));
router.get("/download-creditcardcharge", asyncHandler(downloadCreditCardCharge));
router.get("/download-transfer", asyncHandler(downloadTransfer));
router.get("/download-billpayment", asyncHandler(downloadBillPayment));

export default router;
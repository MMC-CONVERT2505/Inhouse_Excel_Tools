import { Router } from "express";
const router = Router();
import multer from "multer";
const upload = multer({ dest: "uploads/" });

import { uploadCoa, processCoa, downloadCoa } from "../controllers/australiaControllers/chartOfAccount.js";
import { uploadCustomer, processCustomer, downloadCustomer } from "../controllers/australiaControllers/customer.js";
import { uploadSupplier, processSupplier, downloadSupplier } from "../controllers/australiaControllers/supplier.js";
import { downloadClass, processClass, uploadClass } from "../controllers/australiaControllers/class_job.js";
import { downloadItem, processItem, uploadItem } from "../controllers/australiaControllers/item.js";
import { downloadtrackedItem, processtrackedItem, uploadtrackedItem, } from "../controllers/australiaControllers/trackedItems.js"; 
import { downloadOpenAR, processOpenAR, uploadOpenAR } from "../controllers/australiaControllers/openAR.js";
import { downloadOpenAP, processOpenAP, uploadOpenAP } from "../controllers/australiaControllers/openAP.js";
import { downloadInvoice, processInvoice, uploadInvoice } from "../controllers/australiaControllers/invoice.js";
import { downloadAdjustmentNote, processAdjustmentNote, uploadAdjustmentNote } from "../controllers/australiaControllers/adjustmentNote.js";
import { downloadBill, processBill, uploadBill } from "../controllers/australiaControllers/bill.js";
import { downloadSupplierCredit, processSupplierCredit, uploadSupplierCredit } from "../controllers/australiaControllers/supplierCredit.js"; 
import { downloadCheque, processCheque, uploadCheque } from "../controllers/australiaControllers/cheque.js";
import { downloadDeposit, processDeposit, uploadDeposit } from "../controllers/australiaControllers/deposit.js";
import { downloadJournal, processJournal, uploadJournal } from "../controllers/australiaControllers/journal.js"; 
import { downloadCreditCardCharge, processCreditCardCharge, uploadCreditCardCharge } from "../controllers/australiaControllers/creditCardCharge.js"; 
import { downloadTransfer, processTransfer, uploadTransfer } from "../controllers/australiaControllers/transfer.js";
import { downloadBillPayment, processBillPayment, uploadBillPayment } from "../controllers/australiaControllers/billPayment.js";
import { downloadInvoicePayment, processInvoicePayment, uploadInvoicePayment } from "../controllers/australiaControllers/invoicePayment.js"; 
import { downloadBillPaymentCreditCard, processBillPaymentCreditCard, uploadBillPaymentCreditCard } from "../controllers/australiaControllers/billPaymentCreditCard.js"; 
import { downloadOpeningBalance, processOpeningBalance, uploadOpeningBalance } from "../controllers/australiaControllers/openingBalance.js"; 
import { downloadJournalEntry, processJournalEntry, uploadJournalEntry } from "../controllers/australiaControllers/journalEntry.js";
import{ downloadEstimates, processEstimates, uploadEstimates } from "../controllers/australiaControllers/estimates.js"; 
import{ downloadPurchaseOrder, processPurchaseOrder, uploadPurchaseOrder } from "../controllers/australiaControllers/purchaseOrder.js"
import { downloadTrackedInvoice, processTrackedInvoice, uploadTrackedInvoice } from "../controllers/australiaControllers/trackedInvoice.js";
import { downloadTrackedAdjustmentNote, processTrackedAdjustmentNote, uploadTrackedAdjustmentNote } from "../controllers/australiaControllers/trackedAdjustmentNote.js";
// Utility to wrap async route handlers and catch errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Upload routes
router.post("/upload-coa", upload.single("file"), asyncHandler(uploadCoa));
router.post("/upload-customer", upload.single("file"), asyncHandler(uploadCustomer));
router.post("/upload-supplier", upload.single("file"), asyncHandler(uploadSupplier));
router.post("/upload-class", upload.single("file"), asyncHandler(uploadClass));
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
router.post("/upload-invoicepayment", upload.single("file"), asyncHandler(uploadInvoicePayment));
router.post("/upload-billpaymentcreditcard", upload.single("file"), asyncHandler(uploadBillPaymentCreditCard));
router.post("/upload-openingbalance", upload.single("file"), asyncHandler(uploadOpeningBalance));
router.post("/upload-journalentry", upload.single("file"), asyncHandler(uploadJournalEntry));
router.post("/upload-estimates", upload.single("file"), asyncHandler(uploadEstimates));
router.post("/upload-purchaseorder", upload.single("file"), asyncHandler(uploadPurchaseOrder));

// Corrected: Accept 2 files for Tracked Invoice
router.post("/upload-trackeditem", upload.single("file"), asyncHandler(uploadtrackedItem));
router.post("/upload-trackedinvoice", upload.array("files", 2), asyncHandler(uploadTrackedInvoice));
router.post("/upload-trackedadjustmentnote", upload.array("files", 2), asyncHandler(uploadTrackedAdjustmentNote));

// Convert routes
router.post("/process-coa", asyncHandler(processCoa));
router.post("/process-customer", asyncHandler(processCustomer));
router.post("/process-supplier", asyncHandler(processSupplier));
router.post("/process-class", asyncHandler(processClass));
router.post("/process-item", asyncHandler(processItem));
router.post("/process-trackeditem", asyncHandler(processtrackedItem));
router.post("/process-openar", asyncHandler(processOpenAR));
router.post("/process-openap", asyncHandler(processOpenAP));
router.post("/process-invoice", asyncHandler(processInvoice));
router.post("/process-adjustmentnote", asyncHandler(processAdjustmentNote));
router.post("/process-bill", asyncHandler(processBill));
router.post("/process-suppliercredit", asyncHandler(processSupplierCredit));
router.post("/process-cheque", asyncHandler(processCheque));
router.post("/process-deposit", asyncHandler(processDeposit));
router.post("/process-journal", asyncHandler(processJournal));
router.post("/process-creditcardcharge", asyncHandler(processCreditCardCharge));
router.post("/process-transfer", asyncHandler(processTransfer));
router.post("/process-billpayment", asyncHandler(processBillPayment));
router.post("/process-invoicepayment", asyncHandler(processInvoicePayment));
router.post("/process-billpaymentcreditcard", asyncHandler(processBillPaymentCreditCard));
router.post("/process-openingbalance", asyncHandler(processOpeningBalance));
router.post("/process-journalentry", asyncHandler(processJournalEntry));
router.post("/process-estimates", asyncHandler(processEstimates));
router.post("/process-purchaseorder", asyncHandler(processPurchaseOrder));
router.post("/process-trackedinvoice", asyncHandler(processTrackedInvoice))
router.post("/process-trackedadjustmentnote", asyncHandler(processTrackedAdjustmentNote))

// Download routes
router.get("/download-coa", asyncHandler(downloadCoa));
router.get("/download-customer", asyncHandler(downloadCustomer));
router.get("/download-supplier", asyncHandler(downloadSupplier));
router.get("/download-class", asyncHandler(downloadClass));
router.get("/download-item", asyncHandler(downloadItem));
router.get("/download-trackeditem", asyncHandler(downloadtrackedItem));
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
router.get("/download-invoicepayment", asyncHandler(downloadInvoicePayment));
router.get("/download-billpaymentcreditcard", asyncHandler(downloadBillPaymentCreditCard));
router.get("/download-openingbalance", asyncHandler(downloadOpeningBalance));
router.get("/download-journalentry", asyncHandler(downloadJournalEntry));
router.get("/download-estimates", asyncHandler(downloadEstimates)); 
router.get("/download-purchaseorder", asyncHandler(downloadPurchaseOrder)); 
router.get("/download-trackedinvoice", asyncHandler(downloadTrackedInvoice));
router.get("/download-trackedadjustmentnote", asyncHandler(downloadTrackedAdjustmentNote));

export default router;
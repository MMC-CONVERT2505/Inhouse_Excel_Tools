import { Router } from "express";
// const router = Router();
import multer from "multer";

import express from 'express';
import {
  handleCustomerUpload,
  handleCustomerConvert,
  downloadCustomerSage,
  upload as customerUpload
} from '../controllers/sageControllers/customer.js';

import {
  handleItemUpload,
  handleItemConvert,
  downloadItem,
  upload as itemUpload
} from '../controllers/sageControllers/item.js';

import {
  handleSupplierUpload,
  handleSupplierConvert,
  downloadSupplier,
  upload as supplierUpload
} from '../controllers/sageControllers/supplier.js';

import {
  handleJournalUpload,
  handleJournalConvert,
  downloadJournal,
  upload as journalUpload
} from '../controllers/sageControllers/journal.js';

import {
  handleOpeningUpload,
  handleOpeningConvert,
  downloadOpening,
  upload as openingUpload
} from '../controllers/sageControllers/openingBalance.js';

import {
  handleAPUpload,
  handleAPConvert,
  downloadAP,
  upload as apUpload
} from '../controllers/sageControllers/AP.js';

import {
  handleARUpload,
  handleARConvert,
  downloadAR,
  upload as arUpload
} from '../controllers/sageControllers/AR.js';

import {
  handleCoaUpload,
  handleCoaConvert,
  downloadCoa,
  upload as coaUpload
} from '../controllers/sageControllers/coaBankController.js';

import {
  handleTaxInvoiceUpload,
  handleTaxInvoiceConvert,
  downloadTaxInvoice,
  upload as taxInvoiceUpload
} from '../controllers/sageControllers/taxInvoice.js';

import {
  handleCreditNoteUpload,
  handleCreditNoteConvert,
  downloadCreditNote,
  upload
} from '../controllers/sageControllers/creditNote.js';

import {
  handleSupplierPaymentUpload,
  handleSupplierPaymentConvert,
  downloadSupplierPayment,
  upload as supplierPaymentUpload
} from '../controllers/sageControllers/supplierPayment.js';

import {
  upload as customerReceiptUpload,
  handleCustomerReceiptUpload,
  handleCustomerReceiptConvert,
  downloadCustomerReceipt
} from '../controllers/sageControllers/customerReceipt.js';

import {
  handleSupplierBillUpload,
  handleSupplierBillConvert,
  downloadSupplierBill,
  upload as supplierBillUpload
} from '../controllers/sageControllers/supplierBill.js';

import {
  handleAccountPaymentUpload,
  handleAccountPaymentConvert,
  downloadAccountPayment,
  upload as accountPaymentUpload
} from '../controllers/sageControllers/accountPayment.js';

import {
  handleAccountReceiptUpload,
  handleAccountReceiptConvert,
  downloadAccountReceipt,
  upload as accountReceiptUpload
} from '../controllers/sageControllers/accountReceiptDeposit.js';

import {
  handleVendorCreditUpload,
  handleVendorCreditConvert,
  downloadVendorCredit,
  upload as vendorCreditUpload
} from '../controllers/sageControllers/vendorCredit.js';
import {
  handleTransferUpload,
  handleTransferConvert,
  downloadTransfer,
  upload as transferUpload
} from '../controllers/sageControllers/transferHandlers.js'




const router = express.Router();

// ✅ Async wrapper to catch errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 🔹 Transfer Routes
router.post('/upload-transfer', transferUpload.single('file'), handleTransferUpload);
router.post('/process-transfer', asyncHandler(handleTransferConvert));
router.get('/download-transfer', asyncHandler(downloadTransfer));


// 🔹 Item Routes
router.post('/upload-Item', itemUpload.single('file'), handleItemUpload);
router.post('/process-Item', asyncHandler(handleItemConvert));
router.get('/download-Item', asyncHandler(downloadItem));

// 🔹 Customer Routes
router.post('/upload-customersage', customerUpload.single('file'), handleCustomerUpload);
router.post('/process-customersage', asyncHandler(handleCustomerConvert));
router.get('/download-customersage', asyncHandler(downloadCustomerSage));

// 🔹 Journal Routes
router.post('/upload-journal', journalUpload.single('file'), handleJournalUpload);
router.post('/process-journal', asyncHandler(handleJournalConvert));
router.get('/download-journal', asyncHandler(downloadJournal));

// 🔹 Supplier Routes
router.post('/upload-supplier', supplierUpload.single('file'), handleSupplierUpload);
router.post('/process-supplier', asyncHandler(handleSupplierConvert));
router.get('/download-supplier', asyncHandler(downloadSupplier));

// ✅ 🔁 Opening Balance Routes (NEWLY ADDED)
router.post('/upload-openingbalance', openingUpload.single('file'), handleOpeningUpload);
router.post('/process-openingbalance', asyncHandler(handleOpeningConvert));
router.get('/download-openingbalance', asyncHandler(downloadOpening));

// 🔹 AP Routes
router.post('/upload-ap', apUpload.single('file'), handleAPUpload);
router.post('/process-ap', asyncHandler(handleAPConvert));
router.get('/download-ap', asyncHandler(downloadAP));

// 🔹 AR Routes
router.post('/upload-ar', arUpload.single('file'), handleARUpload);
router.post('/process-ar', asyncHandler(handleARConvert));
router.get('/download-ar', asyncHandler(downloadAR));

// 🔹 Chart of Accounts (COA)
router.post('/upload-coa', coaUpload.fields([
  { name: 'coa', maxCount: 1 },
  { name: 'bankcard', maxCount: 1 }
]), handleCoaUpload);
router.post('/process-coa', asyncHandler(handleCoaConvert));
router.get('/download-coa', asyncHandler(downloadCoa));

// 🔹 Tax Invoice
router.post('/upload-taxinvoice', taxInvoiceUpload.fields([
  { name: 'invoice', maxCount: 1 },
  { name: 'item', maxCount: 1 },
  { name: 'coa', maxCount: 1 },
  { name: 'tax', maxCount: 1 }
]), handleTaxInvoiceUpload);
router.post('/process-taxinvoice', handleTaxInvoiceConvert);
router.get('/download-taxinvoice', downloadTaxInvoice);

// creditnote
router.post('/upload-creditnote', upload.fields([
  { name: 'invoice', maxCount: 1 },
  { name: 'item', maxCount: 1 },
  { name: 'coa', maxCount: 1 },
  { name: 'tax', maxCount: 1 }
]), handleCreditNoteUpload);
router.post('/process-creditnote', asyncHandler(handleCreditNoteConvert));
router.get('/download-creditnote', asyncHandler(downloadCreditNote));

// 🔹 Supplier Payment
router.post('/upload-supplierpayment', supplierPaymentUpload.fields([
  { name: 'payment', maxCount: 1 },
  { name: 'supplier', maxCount: 1 },
  { name: 'coa', maxCount: 1 }
]), handleSupplierPaymentUpload);
router.post('/process-supplierpayment', asyncHandler(handleSupplierPaymentConvert));
router.get('/download-supplierpayment', asyncHandler(downloadSupplierPayment));

// 🔹 customer receipt
router.post('/upload-customerreceipt', customerReceiptUpload.fields([
  { name: 'payment', maxCount: 1 },
  { name: 'coa', maxCount: 1 }
]), handleCustomerReceiptUpload);
router.post('/process-customerreceipt', handleCustomerReceiptConvert);
router.get('/download-customerreceipt', downloadCustomerReceipt);

// 🔹 Supplier Bill Routes (NEW)
router.post('/upload-supplierbill', supplierBillUpload.fields([
  { name: 'invoice', maxCount: 1 },
  { name: 'coa', maxCount: 1 },
  { name: 'tax', maxCount: 1 },
  { name: 'item', maxCount: 1 } 
  
]), handleSupplierBillUpload);
router.post('/process-supplierbill', asyncHandler(handleSupplierBillConvert));
router.get('/download-supplierbill', asyncHandler(downloadSupplierBill));


// 🔹 Account Payment Routes (NEW)
router.post('/upload-accountpayment', upload.fields([
  { name: 'invoice', maxCount: 1 },
  { name: 'coa', maxCount: 1 },
  { name: 'tax', maxCount: 1 }
]), handleAccountPaymentUpload);
router.post('/process-accountpayment', handleAccountPaymentConvert);
router.get('/download-accountpayment', downloadAccountPayment);

// 🔹 Account Receipt (Deposit) Routes (NEW)
router.post('/upload-accountreceipt', accountReceiptUpload.fields([
  { name: 'deposit', maxCount: 1 },
  { name: 'coa', maxCount: 1 },
  { name: 'tax', maxCount: 1 }
]), handleAccountReceiptUpload);
router.post('/process-accountreceipt', asyncHandler(handleAccountReceiptConvert));
router.get('/download-accountreceipt', asyncHandler(downloadAccountReceipt));

// 🔹 Vendor Credit Routes
router.post('/upload-vendorcredit', upload.fields([
  { name: 'invoice', maxCount: 1 },
  { name: 'coa', maxCount: 1 },
  { name: 'tax', maxCount: 1 },
  { name: 'item', maxCount: 1 },
]), handleVendorCreditUpload);

router.post('/process-vendorcredit', asyncHandler(handleVendorCreditConvert));
router.get('/download-vendorcredit', asyncHandler(downloadVendorCredit));


import {
  uploadBillBundle,
  handleBillBundleUpload,
  handleBillBundleConvert,
  downloadBillBundle
} from '../controllers/sageControllers/billBundleFinal.js';

// 🔹 Bill Bundle Routes (Bills + Overpayment)
router.post('/upload-billbundle', uploadBillBundle.fields([
  { name: 'billPayment', maxCount: 1 },
  { name: 'coa', maxCount: 1 },
  { name: 'supplier', maxCount: 1 }
]), handleBillBundleUpload);

router.post('/process-billbundle', asyncHandler(handleBillBundleConvert));

router.get('/download-billbundle', asyncHandler(downloadBillBundle));


import {
  uploadInvoiceOverpayment,
  handleInvoiceOverpaymentUpload,
  handleInvoiceOverpaymentConvert,
  downloadInvoiceOverpayment
} from '../controllers/sageControllers/invoiceOverpayment.js';

router.post('/upload-invoiceoverpayment',
  uploadInvoiceOverpayment.fields([
    { name: 'invoicePayment', maxCount: 1 },
    { name: 'coa',            maxCount: 1 }
  ]),
  handleInvoiceOverpaymentUpload
);

router.post('/process-invoiceoverpayment', asyncHandler(handleInvoiceOverpaymentConvert));
router.get('/download-invoiceoverpayment', asyncHandler(downloadInvoiceOverpayment));

// ✅ NEW: discount module imports (unique names)
import {
  uploadInvoiceDiscount,
  handleInvoiceDiscountUpload,
  handleInvoiceDiscountConvert,
  downloadInvoiceDiscount
} from '../controllers/sageControllers/invoicediscount.js';

router.post('/upload-invoicediscount',
  uploadInvoiceDiscount.fields([
    { name: 'invoicePayment', maxCount: 1 }, // 👈 same field your upload uses
    { name: 'item',           maxCount: 1 },
    { name: 'coa',            maxCount: 1 },
    { name: 'tax',            maxCount: 1 }
  ]),
  handleInvoiceDiscountUpload
);
router.post('/process-invoicediscount', asyncHandler(handleInvoiceDiscountConvert));
router.get('/download-invoicediscount', asyncHandler(downloadInvoiceDiscount));


import {
  uploadCreditNoteDiscount,
  handleCreditNoteDiscountUpload,
  handleCreditNoteDiscountConvert,
  downloadCreditNoteDiscount
} from '../controllers/sageControllers/creditNoteDiscount.js';

router.post('/upload-creditnotediscount', uploadCreditNoteDiscount.fields([
  { name: 'creditNote', maxCount: 1 },
  { name: 'item', maxCount: 1 },
  { name: 'coa', maxCount: 1 },
  { name: 'tax', maxCount: 1 }
]), handleCreditNoteDiscountUpload);

router.post('/process-creditnotediscount', handleCreditNoteDiscountConvert);
router.get('/download-creditnotediscount', downloadCreditNoteDiscount);

export default router;

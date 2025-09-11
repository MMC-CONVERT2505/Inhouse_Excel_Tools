import { Router } from "express";
import multer from "multer";
const router = Router();

// Storage config
import path from 'path';
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Import controllers
import {
  convertCOA, uploadCOA, downloadCOA
} from '../controllers/rtxControllers/coaMapping.js';
import {
  convertCustomer, uploadCustomer, downloadCustomer
} from '../controllers/rtxControllers/customerMapping.js';
import {
  convertVendor, uploadVendor, downloadVendor
} from '../controllers/rtxControllers/vendorMapping.js';
import {
  uploadItem, convertItem, downloadItem
} from '../controllers/rtxControllers/itemMapping.js';
import {
  uploadTracking, convertTracking, downloadTracking
} from '../controllers/rtxControllers/trackingCLass.js';
import {
  uploadARInvoice, convertARInvoice, downloadARInvoice
} from '../controllers/rtxControllers/arInvoice.js';
import {
  uploadAPBill, convertAPBill, downloadAPBill
} from '../controllers/rtxControllers/apBills.js';
import {
  uploadInvoice, convertInvoice, downloadInvoice
} from '../controllers/rtxControllers/invoice.js';
import {
  uploadAdjustmentNote, convertAdjustmentNote, downloadAdjustmentNote
} from '../controllers/rtxControllers/adjustmentNote.js';
import {
  uploadBill, convertBill, downloadBill
} from '../controllers/rtxControllers/bill.js';
import {
  uploadBillCredit, convertBillCredit, downloadBillCredit
} from '../controllers/rtxControllers/billCredit.js';
import {
  uploadSalesReceipt, convertSalesReceipt, downloadSalesReceipt
} from '../controllers/rtxControllers/salesReceipt.js';
import {
  uploadManualJournal, convertManualJournal, downloadManualJournal
} from '../controllers/rtxControllers/manualJournal.js';
import {
  uploadSpendMoney, convertSpendMoney, downloadSpendMoney
} from '../controllers/rtxControllers/spendMoney.js';
import {
  uploadReceiveMoney, convertReceiveMoney, downloadReceiveMoney
} from '../controllers/rtxControllers/receiveMoney.js';
import {
  uploadInvoicePayment, convertInvoicePayment, downloadInvoicePayment
} from '../controllers/rtxControllers/invoicePayment.js';
import {
  uploadBillPayment, convertBillPayment, downloadBillPayment
} from '../controllers/rtxControllers/billPayment.js';
import {
  uploadPaycheque, convertPaycheque, downloadPaycheque
} from '../controllers/rtxControllers/paycheque.js';
import {
  uploadLiabilityCheque, convertLiabilityCheque, downloadLiabilityCheque
} from '../controllers/rtxControllers/liabilityCheque.js';
import {
  uploadConversionBalance, convertConversionBalance,
  downloadConversionBalance
} from '../controllers/rtxControllers/conversionBalance.js';
import {
  uploadInventoryAdjust, convertInventoryAdjust, downloadInventoryAdjust
} from '../controllers/rtxControllers/inventoryAdjust.js';
import {
  uploadSpendOverpayment, convertSpendOverpayment, downloadSpendOverpayment
} from '../controllers/rtxControllers/spendOverpayment.js';
import {
  uploadReceiveOverpayment, convertReceiveOverpayment, downloadReceiveOverpayment
} from '../controllers/rtxControllers/receiveOverpayment.js';
import {
  uploadBankTransfer, convertBankTransfer, downloadBankTransfer
} from '../controllers/rtxControllers/transfer.js';


// Upload routes
router.post('/upload-coa', upload.single('file'), uploadCOA);
router.post('/upload-customer', upload.single('file'), uploadCustomer);
router.post('/upload-vendor', upload.single('file'), uploadVendor);
router.post('/upload-item', upload.single('file'), uploadItem);
router.post('/upload-tracking', upload.single('file'), uploadTracking);
router.post('/upload-arInvoice', upload.single('file'), uploadARInvoice);
router.post('/upload-apBill', upload.single('file'), uploadAPBill);
router.post('/upload-invoice', upload.single('file'), uploadInvoice);
router.post('/upload-adjustmentNote', upload.single('file'), uploadAdjustmentNote);
router.post('/upload-bill', upload.single('file'), uploadBill);
router.post('/upload-billCredit', upload.single('file'), uploadBillCredit);
router.post('/upload-salesReceipt', upload.single('file'), uploadSalesReceipt);
router.post('/upload-manualJournal', upload.single('file'), uploadManualJournal);
router.post('/upload-spendMoney', upload.single('file'), uploadSpendMoney);
router.post('/upload-receiveMoney', upload.single('file'), uploadReceiveMoney);
router.post('/upload-invoicePayment', upload.single('file'), uploadInvoicePayment);
router.post('/upload-billPayment', upload.single('file'), uploadBillPayment);
router.post('/upload-paycheque', upload.single('file'), uploadPaycheque);
router.post('/upload-liabilityCheque', upload.single('file'), uploadLiabilityCheque);
router.post('/upload-conversionBalance', upload.single('file'), uploadConversionBalance);
router.post('/upload-inventoryAdjust', upload.single('file'), uploadInventoryAdjust);
router.post('/upload-spendOverpayment', upload.single('file'), uploadSpendOverpayment);
router.post('/upload-receiveOverpayment', upload.single('file'), uploadReceiveOverpayment);
router.post('/upload-bankTransfer', upload.single('file'), uploadBankTransfer);
router.post('/upload-allType', upload.single('file'), uploadBankTransfer);


// Convert routes
router.post('/process-coa', convertCOA);
router.post('/process-customer', convertCustomer);
router.post('/process-vendor', convertVendor);
router.post('/process-item', convertItem);
router.post('/process-tracking', convertTracking);
router.post('/process-arInvoice', convertARInvoice);
router.post('/process-apBill', convertAPBill);
router.post('/process-invoice', convertInvoice);
router.post('/process-adjustmentNote', convertAdjustmentNote);
router.post('/process-bill', convertBill);
router.post('/process-billCredit', convertBillCredit);
router.post('/process-salesReceipt', convertSalesReceipt);
router.post('/process-manualJournal', convertManualJournal);
router.post('/process-spendMoney', convertSpendMoney);
router.post('/process-receiveMoney', convertReceiveMoney);
router.post('/process-invoicePayment', convertInvoicePayment);
router.post('/process-billPayment', convertBillPayment);
router.post('/process-paycheque', convertPaycheque);
router.post('/process-liabilityCheque', convertLiabilityCheque);
router.post('/process-conversionBalance', convertConversionBalance);
router.post('/process-inventoryAdjust', convertInventoryAdjust);
router.post('/process-spendOverpayment', convertSpendOverpayment);
router.post('/process-receiveOverpayment', convertReceiveOverpayment);
router.post('/process-bankTransfer', convertBankTransfer);
router.post('/process-allType', convertBankTransfer);

// Download routes
router.get('/download-coa/:filename', downloadCOA);
router.get('/download-customer/:filename', downloadCustomer);
// router.get('/:prefix/:currency/download-customer/:filename', downloadCustomer);
router.get('/download-vendor/:filename', downloadVendor);
router.get('/download-item/:filename', downloadItem);
router.get('/download-tracking/:filename', downloadTracking);
router.get('/download-arInvoice/:filename', downloadARInvoice);
router.get('/download-apBill/:filename', downloadAPBill);
router.get('/download-invoice/:filename', downloadInvoice);
router.get('/download-adjustmentNote/:filename', downloadAdjustmentNote);
router.get('/download-bill/:filename', downloadBill);
router.get('/download-billCredit/:filename', downloadBillCredit);
router.get('/download-salesReceipt/:filename', downloadSalesReceipt);
router.get('/download-manualJournal/:filename', downloadManualJournal);
router.get('/download-spendMoney/:filename', downloadSpendMoney);
router.get('/download-receiveMoney/:filename', downloadReceiveMoney);
router.get('/download-invoicePayment/:filename', downloadInvoicePayment);
router.get('/download-billPayment/:filename', downloadBillPayment);
router.get('/download-paycheque/:filename', downloadPaycheque);
router.get('/download-liabilityCheque/:filename', downloadLiabilityCheque);
router.get('/download-conversionBalance/:filename', downloadConversionBalance);
router.get('/download-inventoryAdjust/:filename', downloadInventoryAdjust);
router.get('/download-spendOverpayment/:filename', downloadSpendOverpayment);
router.get('/download-receiveOverpayment/:filename', downloadReceiveOverpayment);
router.get('/download-bankTransfer/:filename', downloadBankTransfer);
router.get('/download-allType/:filename', downloadBankTransfer);

export { router };

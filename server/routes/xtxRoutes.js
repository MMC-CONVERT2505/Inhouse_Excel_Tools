import { Router } from 'express';
const router = Router();
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ✅ Define __dirname manually for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Multer config
const upload = multer({ dest: join(__dirname, '../uploads/') });

import { coaHandler, convertHandler, downloadHandler } from '../controllers/xtxControllers/coaController.js';
import { contactHandler, contactDownload, contactConvert } from '../controllers/xtxControllers/contactController.js';
import { itemsHandler, itemsConvert, itemsDownload } from '../controllers/xtxControllers/items.js';
import { classHandler, classConvert, classDownload } from '../controllers/xtxControllers/class.js';
import { arHandler, arConvert, arDownload } from '../controllers/xtxControllers/openAR.js';
import { apHandler, apConvert, apDownload } from '../controllers/xtxControllers/openAP.js';
import { invoiceHandler, invoiceConvert, invoiceDownload } from '../controllers/xtxControllers/invoice.js';
import { creditHandler, creditConvert, creditDownload } from '../controllers/xtxControllers/creditnote.js';
import { manualHandler, manualConvert, manualDownload } from '../controllers/xtxControllers/manualJournal.js';
import { spendHandler, spendConvert, spendDownload } from '../controllers/xtxControllers/spendmoney.js';
import { receiveHandler, receiveConvert, receiveDownload } from '../controllers/xtxControllers/receivemoney.js';
import { billpaymentHandler, billpaymentConvert, billpaymentDownload } from '../controllers/xtxControllers/billpayment.js';
import { transferHandler, transferConvert, transferDownload } from '../controllers/xtxControllers/transfer.js';
import { billHandler, billConvert, billDownload } from '../controllers/xtxControllers/bill.js';
import { authbillHandler, authbillConvert, authbillDownload } from '../controllers/xtxControllers/authbill.js';
import { billpaidHandler, billpaidConvert, billpaidDownload } from '../controllers/xtxControllers/billpaid.js';
import { paidinvoiceHandler, paidinvoiceConvert, paidinvoiceDownload } from '../controllers/xtxControllers/paidinvoice.js';
import { authinvoiceHandler, authinvoiceConvert, authinvoiceDownload } from '../controllers/xtxControllers/authinvoice.js';
import { invoicepaymentHandler, invoicepaymentConvert, invoicepaymentDownload } from '../controllers/xtxControllers/invoicepayment.js';
import { conversionbalanceHandler, conversionbalanceConvert, conversionbalanceDownload } from '../controllers/xtxControllers/conversionbalance.js';
import { authcreditnoteHandler, authcreditnoteConvert, authcreditnoteDownload } from '../controllers/xtxControllers/authcreditnote.js';
import { paidcreditnoteHandler, paidcreditnoteConvert, paidcreditnoteDownload } from '../controllers/xtxControllers/paidcreditnote.js';
import { authbillcreditHandler, authbillcreditConvert, authbillcreditDownload } from '../controllers/xtxControllers/authbillcredit.js';
import { paidbillcreditConvert, paidbillcreditDownload, paidbillcreditHandler } from '../controllers/xtxControllers/paidbillcredit.js';

// const router = Router();

// ✅ Single uploads
router.post('/upload-coa', upload.single('file'), coaHandler);
router.post('/upload-contact', upload.single('file'), contactHandler);
router.post('/upload-items', upload.single('file'), itemsHandler);
router.post('/upload-class', upload.single('file'), classHandler);
router.post('/upload-ar', upload.single('file'), arHandler);
router.post('/upload-ap', upload.single('file'), apHandler);
router.post('/upload-invoice', upload.single('file'), invoiceHandler);
router.post('/upload-creditnote', upload.single('file'), creditHandler);
router.post('/upload-manualJournal', upload.single('file'), manualHandler);
router.post('/upload-spendmoney', upload.single('file'), spendHandler);
router.post('/upload-receivemoney', upload.single('file'), receiveHandler);
router.post('/upload-billpayment', upload.single('file'), billpaymentHandler);
router.post('/upload-transfer', upload.single('file'), transferHandler);
router.post('/upload-bill', upload.single('file'), billHandler);
router.post('/upload-invoicepayment', upload.single('file'), invoicepaymentHandler);

// ✅ Dual uploads
const dualUpload = upload.fields([{ name: 'file', maxCount: 1 }, { name: 'file2', maxCount: 1 }]);
router.post('/upload-authbill', dualUpload, authbillHandler);
router.post('/upload-billpaid', dualUpload, billpaidHandler);
router.post('/upload-paidinvoice', dualUpload, paidinvoiceHandler);
router.post('/upload-authinvoice', dualUpload, authinvoiceHandler);
router.post('/upload-authcreditnote', dualUpload, authcreditnoteHandler); 
router.post('/upload-paidcreditnote', dualUpload, paidcreditnoteHandler);
router.post('/upload-authbillcredit', dualUpload, authbillcreditHandler);
router.post('/upload-paidbillcredit', dualUpload, paidbillcreditHandler);
router.post('/upload-conversionbalance', dualUpload, conversionbalanceHandler);

// ✅ Convert routes
router.post('/process-coa', convertHandler);
router.post('/process-contact', contactConvert);
router.post('/process-items', itemsConvert);
router.post('/process-class', classConvert);
router.post('/process-ar', arConvert);
router.post('/process-ap', apConvert);
router.post('/process-invoice', invoiceConvert);
router.post('/process-creditnote', creditConvert);
router.post('/process-manualJournal', manualConvert);
router.post('/process-spendmoney', spendConvert);
router.post('/process-receivemoney', receiveConvert);
router.post('/process-billpayment', billpaymentConvert);
router.post('/process-transfer', transferConvert);
router.post('/process-bill', billConvert);
router.post('/process-authbill', authbillConvert);
router.post('/process-billpaid', billpaidConvert);
router.post('/process-paidinvoice', paidinvoiceConvert);
router.post('/process-authinvoice', authinvoiceConvert);
router.post('/process-authcreditnote', authcreditnoteConvert);
router.post('/process-paidcreditnote', paidcreditnoteConvert);
router.post('/process-authbillcredit', authbillcreditConvert);
router.post('/process-paidbillcredit', paidbillcreditConvert);
router.post('/process-invoicepayment', invoicepaymentConvert);
router.post('/process-conversionbalance', conversionbalanceConvert);

// ✅ Download routes
router.get('/download-coa', downloadHandler);
router.get('/download-contact', contactDownload);
router.get('/download-items', itemsDownload);
router.get('/download-class', classDownload);
router.get('/download-ar', arDownload);
router.get('/download-ap', apDownload);
router.get('/download-invoice', invoiceDownload);
router.get('/download-creditnote', creditDownload);
router.get('/download-manualJournal', manualDownload);
router.get('/download-spendmoney', spendDownload);
router.get('/download-receivemoney', receiveDownload);
router.get('/download-billpayment', billpaymentDownload);
router.get('/download-transfer', transferDownload);
router.get('/download-bill', billDownload);
router.get('/download-authbill', authbillDownload);
router.get('/download-billpaid', billpaidDownload);
router.get('/download-paidinvoice', paidinvoiceDownload);
router.get('/download-authinvoice', authinvoiceDownload);
router.get('/download-authcreditnote', authcreditnoteDownload);
router.get('/download-paidcreditnote', paidcreditnoteDownload);
router.get('/download-authbillcredit', authbillcreditDownload);
router.get('/download-paidbillcredit', paidbillcreditDownload);
router.get('/download-invoicepayment', invoicepaymentDownload);
router.get('/download-conversionbalance', conversionbalanceDownload);

export default router;

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

import { coaHandlerMulti, convertHandlerMulti, downloadHandlerMulti } from '../controllers/xtxMultiControllers/coaController.js';
import { contactHandlerMulti, contactConvertMulti, contactDownloadMulti } from '../controllers/xtxMultiControllers/contactController.js';
import { itemsHandlerMulti, itemsConvertMulti, itemsDownloadMulti } from '../controllers/xtxMultiControllers/items.js';
import { classHandlerMulti, classConvertMulti, classDownloadMulti } from '../controllers/xtxMultiControllers/class.js';
import { arHandlerMulti, arConvertMulti, arDownloadMulti } from '../controllers/xtxMultiControllers/openAR.js';
import { apHandlerMulti, apConvertMulti, apDownloadMulti } from '../controllers/xtxMultiControllers/openAP.js';
import { invoiceHandlerMulti, invoiceConvertMulti, invoiceDownloadMulti } from '../controllers/xtxMultiControllers/invoice.js';
import { creditHandlerMulti, creditConvertMulti, creditDownloadMulti } from '../controllers/xtxMultiControllers/creditnote.js';
import { manualHandlerMulti, manualConvertMulti, manualDownloadMulti } from '../controllers/xtxMultiControllers/manualJournal.js';
import { spendHandlerMulti, spendConvertMulti, spendDownloadMulti } from '../controllers/xtxMultiControllers/spendmoney.js';
import { receiveHandlerMulti, receiveConvertMulti, receiveDownloadMulti } from '../controllers/xtxMultiControllers/receivemoney.js';
import { billpaymentHandlerMulti, billpaymentConvertMulti, billpaymentDownloadMulti } from '../controllers/xtxMultiControllers/billpayment.js';
import { transferHandlerMulti, transferConvertMulti, transferDownloadMulti } from '../controllers/xtxMultiControllers/transfer.js';
import { billHandlerMulti, billConvertMulti, billDownloadMulti } from '../controllers/xtxMultiControllers/bill.js';
import { authbillHandlerMulti, authbillConvertMulti, authbillDownloadMulti } from '../controllers/xtxMultiControllers/authbill.js';
import { billpaidHandlerMulti, billpaidConvertMulti, billpaidDownloadMulti } from '../controllers/xtxMultiControllers/billpaid.js';
import { paidinvoiceHandlerMulti, paidinvoiceConvertMulti, paidinvoiceDownloadMulti } from '../controllers/xtxMultiControllers/paidinvoice.js';
import { authinvoiceHandlerMulti, authinvoiceConvertMulti, authinvoiceDownloadMulti } from '../controllers/xtxMultiControllers/authinvoice.js';
import { invoicepaymentHandlerMulti, invoicepaymentConvertMulti, invoicepaymentDownloadMulti } from '../controllers/xtxMultiControllers/invoicepayment.js';
import { conversionbalanceHandlerMulti, conversionbalanceConvertMulti, conversionbalanceDownloadMulti } from '../controllers/xtxMultiControllers/conversionbalance.js';
import { authcreditnoteHandlerMulti, authcreditnoteConvertMulti, authcreditnoteDownloadMulti } from '../controllers/xtxMultiControllers/authcreditnote.js';
import { paidcreditnoteHandlerMulti, paidcreditnoteConvertMulti, paidcreditnoteDownloadMulti } from '../controllers/xtxMultiControllers/paidcreditnote.js';
import { authbillcreditHandlerMulti, authbillcreditConvertMulti, authbillcreditDownloadMulti } from '../controllers/xtxMultiControllers/authbillcredit.js';
import { paidbillcreditHandlerMulti, paidbillcreditConvertMulti, paidbillcreditDownloadMulti } from '../controllers/xtxMultiControllers/paidbillcredit.js';

// const router = Router();

// ✅ Single uploads
router.post('/upload-coa', upload.single('file'), coaHandlerMulti);
router.post('/upload-contact', upload.single('file'), contactHandlerMulti);
router.post('/upload-items', upload.single('file'), itemsHandlerMulti);
router.post('/upload-class', upload.single('file'), classHandlerMulti);
router.post('/upload-ar', upload.single('file'), arHandlerMulti);
router.post('/upload-ap', upload.single('file'), apHandlerMulti);
router.post('/upload-invoice', upload.single('file'), invoiceHandlerMulti);
router.post('/upload-creditnote', upload.single('file'), creditHandlerMulti);
router.post('/upload-manualJournal', upload.single('file'), manualHandlerMulti);
router.post('/upload-spendmoney', upload.single('file'), spendHandlerMulti);
router.post('/upload-receivemoney', upload.single('file'), receiveHandlerMulti);
router.post('/upload-billpayment', upload.single('file'), billpaymentHandlerMulti);
router.post('/upload-transfer', upload.single('file'), transferHandlerMulti);
router.post('/upload-bill', upload.single('file'), billHandlerMulti);
router.post('/upload-invoicepayment', upload.single('file'), invoicepaymentHandlerMulti);

// ✅ Dual uploads
const dualUpload = upload.fields([{ name: 'file', maxCount: 1 }, { name: 'file2', maxCount: 1 }]);
router.post('/upload-authbill', dualUpload, authbillHandlerMulti);
router.post('/upload-billpaid', dualUpload, billpaidHandlerMulti);
router.post('/upload-paidinvoice', dualUpload, paidinvoiceHandlerMulti);
router.post('/upload-authinvoice', dualUpload, authinvoiceHandlerMulti);
router.post('/upload-authcreditnote', dualUpload, authcreditnoteHandlerMulti); 
router.post('/upload-paidcreditnote', dualUpload, paidcreditnoteHandlerMulti);
router.post('/upload-authbillcredit', dualUpload, authbillcreditHandlerMulti);
router.post('/upload-paidbillcredit', dualUpload, paidbillcreditHandlerMulti);
router.post('/upload-conversionbalance', dualUpload, conversionbalanceHandlerMulti);

// ✅ Convert routes
router.post('/process-coa', convertHandlerMulti);
router.post('/process-contact', contactConvertMulti);
router.post('/process-items', itemsConvertMulti);
router.post('/process-class', classConvertMulti);
router.post('/process-ar', arConvertMulti);
router.post('/process-ap', apConvertMulti);
router.post('/process-invoice', invoiceConvertMulti);
router.post('/process-creditnote', creditConvertMulti);
router.post('/process-manualJournal', manualConvertMulti);
router.post('/process-spendmoney', spendConvertMulti);
router.post('/process-receivemoney', receiveConvertMulti);
router.post('/process-billpayment', billpaymentConvertMulti);
router.post('/process-transfer', transferConvertMulti);
router.post('/process-bill', billConvertMulti);
router.post('/process-authbill', authbillConvertMulti);
router.post('/process-billpaid', billpaidConvertMulti);
router.post('/process-paidinvoice', paidinvoiceConvertMulti);
router.post('/process-authinvoice', authinvoiceConvertMulti);
router.post('/process-authcreditnote', authcreditnoteConvertMulti);
router.post('/process-paidcreditnote', paidcreditnoteConvertMulti);
router.post('/process-authbillcredit', authbillcreditConvertMulti);
router.post('/process-paidbillcredit', paidbillcreditConvertMulti);
router.post('/process-invoicepayment', invoicepaymentConvertMulti);
router.post('/process-conversionbalance', conversionbalanceConvertMulti);

// ✅ Download routes
router.get('/download-coa', downloadHandlerMulti);
router.get('/download-contact', contactDownloadMulti);
router.get('/download-items', itemsDownloadMulti);
router.get('/download-class', classDownloadMulti);
router.get('/download-ar', arDownloadMulti);
router.get('/download-ap', apDownloadMulti);
router.get('/download-invoice', invoiceDownloadMulti);
router.get('/download-creditnote', creditDownloadMulti);
router.get('/download-manualJournal', manualDownloadMulti);
router.get('/download-spendmoney', spendDownloadMulti);
router.get('/download-receivemoney', receiveDownloadMulti);
router.get('/download-billpayment', billpaymentDownloadMulti);
router.get('/download-transfer', transferDownloadMulti);
router.get('/download-bill', billDownloadMulti);
router.get('/download-authbill', authbillDownloadMulti);
router.get('/download-billpaid', billpaidDownloadMulti);
router.get('/download-paidinvoice', paidinvoiceDownloadMulti);
router.get('/download-authinvoice', authinvoiceDownloadMulti);
router.get('/download-authcreditnote', authcreditnoteDownloadMulti);
router.get('/download-paidcreditnote', paidcreditnoteDownloadMulti);
router.get('/download-authbillcredit', authbillcreditDownloadMulti);
router.get('/download-paidbillcredit', paidbillcreditDownloadMulti);
router.get('/download-invoicepayment', invoicepaymentDownloadMulti);
router.get('/download-conversionbalance', conversionbalanceDownloadMulti);

export default router;

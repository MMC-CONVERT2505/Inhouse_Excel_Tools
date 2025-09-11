import multer from 'multer';
import fs from 'fs';
import { join } from 'path';
import xlsx from 'xlsx';
const { utils, readFile, writeFile } = xlsx;

const uploadDir = join(process.cwd(), '/uploads/customerReceipt');
const outputDir = join(process.cwd(), '/converted');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ✅ Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});

const upload = multer({ storage });

// ✅ Save uploaded files
let uploadedPaymentPath = '';
let uploadedCoaPath = '';
let finalOutputPath = '';

const handleCustomerReceiptUpload = async (req, res) => {
  try {
    const paymentFile = req.files?.payment?.[0];
    const coaFile = req.files?.coa?.[0];

    if (!paymentFile || !coaFile) {
      return res.status(400).json({ error: 'Both Payment and COA files are required' });
    }

    uploadedPaymentPath = paymentFile.path;
    uploadedCoaPath = coaFile.path;

    return res.status(200).json({ message: 'Files uploaded successfully' });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload files' });
  }
};

// ✅ Convert uploaded files to Customer Receipt format
const handleCustomerReceiptConvert = async (req, res) => {
  try {
    const currencyCode = req.body.currencyCode || '';

    const paymentData = readExcel(uploadedPaymentPath);
    const coaData = readExcel(uploadedCoaPath);

    // Map: ID ➝ Name
    const coaMap = {};
    coaData.forEach(row => {
      if (row['ID']) coaMap[String(row['ID'])] = row['Name'] || 'Unknown Bank Account';
    });

    let serial = 1;
    const result = [];

    paymentData.forEach(row => {
      let docNo = row['DocumentNo'] || 'NO_DOC_NO';
      const refNo = `${docNo}_${serial++}`;
      const invoiceNo = row['Invoice_number'];
      const memoBase = row['Description'] || '';
      const memo = (!invoiceNo || String(invoiceNo).trim() === '') ? `${memoBase} (Overpayment)` : memoBase;
      const bankId = row['BankAccountId'];

      result.push({
        'Ref No': refNo,
        'Payment Date': formatDate(row['Date']),
        'Customer': row['CustomerName'] || '',
        'Payment method': row['PaymentMethod'] || '',
        'Deposit To Account Name': coaMap[String(bankId)] || 'Unknown Bank Account',
        'Invoice No': invoiceNo || '',
        'Journal No': '',
        'Amount': row['AppliedAmount'] || '',
        'Reference No': '',
        'Memo': memo,
        'Currency Code': row['Currency Code'] || currencyCode,
        'Exchange Rate': row['Exchange Rate'] || '',
      });
    });

    const wb = utils.book_new();
    const ws = utils.json_to_sheet(result);
    utils.book_append_sheet(wb, ws, 'Customer Receipt');

    const fileName = `Customer_Receipt_${Date.now()}.xlsx`;
    finalOutputPath = join(outputDir, fileName);
    writeFile(wb, finalOutputPath);

    return res.status(200).json({ message: 'Conversion successful' });
  } catch (error) {
    console.error('Convert error:', error);
    return res.status(500).json({ error: 'Conversion failed' });
  }
};

// ✅ Download converted file
const downloadCustomerReceipt = async (req, res) => {
  try {
    if (!fs.existsSync(finalOutputPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(finalOutputPath);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ error: 'Download failed' });
  }
};

// ✅ Helpers
function readExcel(filePath) {
  const wb = readFile(filePath);
  return utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}

function formatDate(value) {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  } catch {
    return '';
  }
}

export {
  upload,
  handleCustomerReceiptUpload,
  handleCustomerReceiptConvert,
  downloadCustomerReceipt
};

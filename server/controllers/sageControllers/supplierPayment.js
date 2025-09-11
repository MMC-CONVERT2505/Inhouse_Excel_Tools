import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, readFile, writeFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Uploaded file paths
let uploadedPaymentPath = '';
let uploadedSupplierPath = '';
let uploadedCoaPath = '';

// ✅ Format date to dd/mm/yyyy
function formatDate(value) {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

// ✅ Read Excel into JSON
function readSheet(filePath) {
  const wb = readFile(filePath);
  return utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}

// ✅ Upload Dir Setup
const uploadDir = join('uploads', 'supplierpayment');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    const uniqueName = `${file.fieldname}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ✅ Upload Handler
const handleSupplierPaymentUpload = (req, res) => {
  try {
    if (
      !req.files || !req.files.payment ||
      !req.files.supplier || !req.files.coa
    ) {
      return res.status(400).json({ message: 'All 3 files (payment, supplier, coa) are required' });
    }

    uploadedPaymentPath = req.files.payment[0].path;
    uploadedSupplierPath = req.files.supplier[0].path;
    uploadedCoaPath = req.files.coa[0].path;

    console.log('✅ Payment File:', uploadedPaymentPath);
    console.log('✅ Supplier File:', uploadedSupplierPath);
    console.log('✅ COA File:', uploadedCoaPath);

    res.status(200).json({ message: 'Files uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Convert Function
const convertSupplierPayment = () => {
  if (
    !fs.existsSync(uploadedPaymentPath) ||
    !fs.existsSync(uploadedSupplierPath) ||
    !fs.existsSync(uploadedCoaPath)
  ) {
    throw new Error('Missing one or more uploaded files');
  }

  const paymentData = readSheet(uploadedPaymentPath);
  const supplierData = readSheet(uploadedSupplierPath);
  const coaData = readSheet(uploadedCoaPath);

  const supplierMap = {};
  const coaMap = {};

  supplierData.forEach(s => {
    if (s['ID']) supplierMap[s['ID']] = s['Name'] || 'Unknown Supplier';
  });

  coaData.forEach(a => {
    if (a['ID']) coaMap[a['ID']] = a['Name'] || 'Unknown Bank Account';
  });

  let globalCounter = 1;
  const finalRows = [];

  paymentData.forEach(row => {
    const docNo = row['DocumentNo'] || 'UNKNOWN';
    const refNo = `${docNo}_${globalCounter++}`;
    const supplierId = row['SupplierId'];
    const bankId = row['BankAccountId'];
    const billNo = row['Invoice_number'];

    const vendorName = supplierMap[supplierId] || 'Unknown Supplier';
    const bankAccount = coaMap[bankId] || 'Unknown Bank Account';
    const memoBase = row['Description'] || '';
    const memo = (!billNo || String(billNo).trim() === '') ? `${memoBase} (Overpayment)` : memoBase;

    finalRows.push({
      'Ref No': refNo,
      'Vendor': vendorName,
      'Payment Date': formatDate(row['Date']),
      'Bank or CC Account': bankAccount,
      'Memo': memo,
      'Bill No': billNo || '',
      'Amount': row['AppliedAmount'],
      'Currency Code': row['Currency Code'] || '',
      'Exchange Rate': row['Exchange Rate'] || '',
      'Print Status': ''
    });
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_supplierpayment_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);

  const newWb = utils.book_new();
  const newWs = utils.json_to_sheet(finalRows);
  utils.book_append_sheet(newWb, newWs, 'Supplier Payment');
  writeFile(newWb, outputPath);

  console.log('✅ Supplier Payment converted:', outputPath);
  return outputPath;
};

// ✅ Convert Handler
const handleSupplierPaymentConvert = (req, res) => {
  try {
    const outputPath = convertSupplierPayment();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadSupplierPayment = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_supplierpayment_') && file.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtime - fs.statSync(join(convertedDir, a)).mtime);

    if (files.length === 0) {
      return res.status(404).json({ message: 'No converted file found' });
    }

    const latestFile = files[0];
    const filePath = join(convertedDir, latestFile);
    res.download(filePath, latestFile);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ message: 'Download failed' });
  }
};

// ✅ Export Handlers
export {
  upload,
  handleSupplierPaymentUpload,
  handleSupplierPaymentConvert,
  downloadSupplierPayment
};

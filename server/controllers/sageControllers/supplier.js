import fs, { mkdirSync, existsSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { readFile, utils, writeFile } = xlsx;

let uploadedSupplierPath = '';

const uploadDir = join('uploads', 'supplier');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, 'supplier_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// ✅ Mapping
const sageoneToQboSupplierMapping = {
  'Name': 'Display Name As',
  'Opening Balance': 'Opening Balance',
  'Postal Address Line 1': 'Billing Address Line 1',
  'Postal Address Line 2': 'Billing Address City',
  'Postal Address Line 3': 'Billing Address Country Subdivision Code',
  'Postal Address Line 4': 'Billing Address Country',
  'Postal Address Postal Code': 'Billing Address Postal Code',
  'Telephone Number': 'Phone',
  'Fax Number': 'Fax',
  'Cell Number': 'Mobile',
  'Email Address': 'Email',
  'Web Address': 'Website',
  'VAT Reference': 'Tax ID',
  'Currency': 'Currency Code'
};

const allowedSupplierColumns = [
  'Display Name As',
  'Opening Balance',
  'Billing Address Line 1',
  'Billing Address City',
  'Billing Address Country Subdivision Code',
  'Billing Address Country',
  'Billing Address Postal Code',
  'Phone',
  'Fax',
  'Mobile',
  'Email',
  'Website',
  'Tax ID',
  'Currency Code'
];

function cleanValue(value) {
  if (value === undefined || value === null) return '';
  let str = String(value).trim();
  return str === '*' ? '' : str;
}

// ✅ Upload Handler
const handleSupplierUpload = (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  uploadedSupplierPath = req.file.path;
  console.log('Supplier file uploaded at:', uploadedSupplierPath);
  res.status(200).json({ message: 'Supplier file uploaded successfully' });
};

// ✅ Convert Logic
const convertSupplier = () => {
  if (!uploadedSupplierPath || !fs.existsSync(uploadedSupplierPath)) {
    throw new Error('No uploaded supplier file found');
  }

  const workbook = readFile(uploadedSupplierPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(sheet, { defval: '' });

  const normalizedRows = rows.map(row => {
    const cleanedRow = {};
    for (const key in row) {
      cleanedRow[key.trim()] = row[key];
    }
    return cleanedRow;
  });

  const outputRows = [];

  normalizedRows.forEach((row, index) => {
    const newRow = {};
    allowedSupplierColumns.forEach(col => newRow[col] = '');

    Object.keys(sageoneToQboSupplierMapping).forEach((sageCol) => {
      const qboCol = sageoneToQboSupplierMapping[sageCol];
      const val = cleanValue(row[sageCol]);

      if (allowedSupplierColumns.includes(qboCol) && val !== '') {
        newRow[qboCol] = val;
      }
    });

    outputRows.push(newRow);
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const fileName = 'converted_supplier_' + Date.now() + '.xlsx';
  const filePath = join(outputDir, fileName);

  const newWb = utils.book_new();
  const newWs = utils.json_to_sheet(outputRows, { header: allowedSupplierColumns });
  utils.book_append_sheet(newWb, newWs, 'Suppliers');
  writeFile(newWb, filePath);

  return filePath;
};

// ✅ Convert Handler
const handleSupplierConvert = (req, res) => {
  try {
    const outputPath = convertSupplier();
    res.status(200).json({ message: 'Supplier conversion successful', path: outputPath });
  } catch (err) {
    console.error('Supplier convert error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadSupplier = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(f => f.startsWith('converted_supplier_') && f.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtime - fs.statSync(join(convertedDir, a)).mtime);

    if (files.length === 0) return res.status(404).json({ message: 'No converted file found' });

    const latestFile = join(convertedDir, files[0]);
    res.download(latestFile);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ message: 'Download failed' });
  }
};

// ✅ Export all
export {
  upload,
  handleSupplierUpload,
  handleSupplierConvert,
  downloadSupplier
};

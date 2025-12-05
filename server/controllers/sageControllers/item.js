import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { utils, writeFile, readFile } = xlsx;

let uploadedItemFilePath = '';

// 🔁 Mapping from SageOne to QBO
const sageoneToQboItemMapping = {
  'Code': 'Name',
  'Description': ['Sales Description', 'Purchase Description'],
  'Category': 'Category',
  'Price Exclusive': 'Price/rate',
  'Item Type (Physical/Service)': 'Type (Service/Inventory/Non-Inventory)',
  'VAT Type Sales': 'Sales Tax Code',
  'VAT Type Purchases': 'Purchase Tax Code',
  'Cost': 'Cost',
  'Sales Account': 'Income Account',
  'Purchases Account': 'Expense account',
  'Quantity': 'Initial Quantity On Hand',
  'Opening Quantity as At': 'As of date',
};

// ✅ Allowed QBO Output Columns
const allowedItemColumns = [
  'Name',
  'Sales Description',
  'Purchase Description',
  'Category',
  'Price/rate',
  'Type (Service/Inventory/Non-Inventory)',
  'Sales Tax Code',
  'Purchase Tax Code',
  'Cost',
  'Income Account',
  'Expense account',
  'Preferred supplier',
  'Initial Quantity On Hand',
  'As of date',
  'Inventory asset account',
];

// ✅ Clean text values
const cleanValue = (value) => {
  if (value === undefined || value === null) return '';
  const str = String(value).trim();
  return str === '*' ? '' : str;
};

// ✅ Remove "rate/rated" from tax names
const sanitizeTaxName = (value) => {
  const v = cleanValue(value);
  if (!v) return '';
  const stripped = v
    .replace(/\brated?\b/gi, '') // remove "rate" or "rated"
    .replace(/\s+/g, ' ')        // collapse spaces
    .trim();
  return stripped;
};

// ✅ Parse numeric values
const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return '';
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : '';
};

// ✅ Setup Upload Folder
const uploadDir = join('uploads', 'item');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, 'item_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// ✅ Upload Handler
const handleItemUpload = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    uploadedItemFilePath = req.file.path;
    console.log('Uploaded path:', uploadedItemFilePath);
    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Convert Logic
const convertItem = () => {
  if (!uploadedItemFilePath || !fs.existsSync(uploadedItemFilePath)) {
    throw new Error('No uploaded file found for conversion');
  }

  const workbook = readFile(uploadedItemFilePath);
  const sheetName = workbook.SheetNames[0];
  const data = utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  const outputRows = data.map((row) => {
    const newRow = {};
    allowedItemColumns.forEach(col => (newRow[col] = ''));

    // main mapping
    Object.entries(sageoneToQboItemMapping).forEach(([sageCol, qboCol]) => {
      const val = cleanValue(row[sageCol]);

      if (Array.isArray(qboCol)) {
        qboCol.forEach(qCol => {
          if (allowedItemColumns.includes(qCol)) newRow[qCol] = val;
        });
      } else {
        if (allowedItemColumns.includes(qboCol)) newRow[qboCol] = val;
      }
    });

    // Fallback: if sheet has old misspelling
    if (!newRow['Price/rate'] && row['Price Excluvie'] !== undefined) {
      newRow['Price/rate'] = cleanValue(row['Price Excluvie']);
    }

    // ✅ Sanitize tax names
    newRow['Sales Tax Code']    = sanitizeTaxName(newRow['Sales Tax Code']);
    newRow['Purchase Tax Code'] = sanitizeTaxName(newRow['Purchase Tax Code']);

    // Parse numeric fields
    newRow['Price/rate'] = toNumber(newRow['Price/rate']);
    newRow['Cost']       = toNumber(newRow['Cost']);

    // Force default type
    newRow['Type (Service/Inventory/Non-Inventory)'] = 'NonInventory';

    return newRow;
  });

  const newWorkbook = utils.book_new();
  const newWorksheet = utils.json_to_sheet(outputRows, { header: allowedItemColumns });
  utils.book_append_sheet(newWorkbook, newWorksheet, 'Items');

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_item_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);
  writeFile(newWorkbook, outputPath);

  return outputPath;
};

// ✅ Convert Handler
const handleItemConvert = (req, res) => {
  try {
    const outputPath = convertItem();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion failed:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadItem = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_item_') && file.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtime - fs.statSync(join(convertedDir, a)).mtime);

    if (files.length === 0) {
      return res.status(404).json({ message: 'No converted item file found' });
    }

    const latestFile = files[0];
    const filePath = join(convertedDir, latestFile);
    res.download(filePath, latestFile);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ message: 'Download failed' });
  }
};

// ✅ EXPORTS
export {
  handleItemUpload,
  handleItemConvert,
  downloadItem,
  upload
};

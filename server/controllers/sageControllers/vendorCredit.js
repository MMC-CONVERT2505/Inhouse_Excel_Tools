import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Upload Paths
let uploadedInvoicePath = '';
let uploadedCoaPath = '';
let uploadedTaxPath = '';
let uploadedItemPath = '';

// Format Excel date ➝ dd/mm/yyyy
function formatDate(value) {
  try {
    let date;
    if (typeof value === 'number') {
      const utcDays = value - 25569;
      const utcValue = utcDays * 86400;
      date = new Date(utcValue * 1000);
    } else {
      date = new Date(value);
    }

    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

// Read Excel into JSON
function readSheet(filePath) {
  const wb = readFile(filePath);
  return utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}

// Tax Mapping
const embeddedTaxMapping = {
  'Standard Rate': 'Standard',
  'Old Standard Rate': 'Old Standard',
  'Old Standard Rate (Capital Goods)': 'Old Capital',
  'Standard Rate (Capital Goods)': 'Capital',
  'Zero Rate': 'Zero Rated',
  'Zero Rate Exports': 'Zero Rated Export',
  'Exempt and Non-Supplies': 'Exempt',
  'Export of Second Hand Goods': 'Second Hand Exports',
  'Change in Use': 'Change In Use'
};

// Upload Directory Setup
const uploadDir = join('uploads', 'vendorcredit');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${file.fieldname}_${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// Upload Handler
const handleVendorCreditUpload = (req, res) => {
  try {
    if (!req.files || !req.files.invoice || !req.files.coa || !req.files.tax || !req.files.item) {
      return res.status(400).json({ message: 'All 4 files (invoice, coa, tax, items) are required' });
    }

    uploadedInvoicePath = req.files.invoice[0].path;
    uploadedCoaPath = req.files.coa[0].path;
    uploadedTaxPath = req.files.tax[0].path;
    uploadedItemPath = req.files.item[0].path;

    console.log('✅ Invoice:', uploadedInvoicePath);
    console.log('✅ COA:', uploadedCoaPath);
    console.log('✅ Tax:', uploadedTaxPath);
    console.log('✅ Items:', uploadedItemPath);

    res.status(200).json({ message: 'Files uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// Main Convert Function
const convertVendorCredit = () => {
  if (!fs.existsSync(uploadedInvoicePath) || !fs.existsSync(uploadedCoaPath) || !fs.existsSync(uploadedTaxPath)) {
    throw new Error('Missing one or more uploaded files');
  }

  const invoiceData = readSheet(uploadedInvoicePath);
  const coaData = readSheet(uploadedCoaPath);
  const taxData = readSheet(uploadedTaxPath);
  const itemData = readSheet(uploadedItemPath);

  const finalRows = [];

  invoiceData.forEach(row => {
    const quantity = row['Line_Quantity'] || 1;
    const rate = row['Line_UnitPriceExclusive'] || 0;
    const amount = +(quantity * rate).toFixed(2);
    const lineType = row['LineType'];
    const selId = row['Line_SelectionId'];

    let account = 'Unknown';
    let description = '';

if (lineType === 1) {
  const match = coaData.find(acc => acc.ID === selId);
  account = match ? match.Name : 'Unknown Account';
  description = match?.Description || '';  // Optional: if COA me Description field hai
} else if (lineType === 0) {
  const itemMatch = itemData.find(item => String(item.ID) === String(selId));
  if (itemMatch) {
    account = itemMatch['Code'] || itemMatch['Description'] || 'Unknown Item';
    description = itemMatch['Description'] || '';
  } else {
    account = 'Unknown Item';
    description = '';
  }
}


    let taxCode = 'Out of Scope';
    if (row['Line_TaxTypeId']) {
      const taxRow = taxData.find(t => t.ID === row['Line_TaxTypeId']);
      const sageTaxName = taxRow?.Name?.trim();
      if (sageTaxName && embeddedTaxMapping[sageTaxName]) {
        taxCode = embeddedTaxMapping[sageTaxName];
      }
    }

    finalRows.push({
      'Ref No': String(row['DocumentNumber']).slice(0, 21),
      'Vendor': row['SupplierName'],
      'Payment Date': formatDate(row['Date']),
      'Memo': row['Message'] || '',
      'Terms': '',
      'Global Tax Calculation': 'TaxExcluded',
      'Expense Account': account,
      'Expense Description': description,
      'Expense Line Amount': amount,
      'Expense Class': '',
      'Expense Tax Code': taxCode || 'Out of Scope',
      'Expense Account Tax Amount': row['Line_Tax'] || 0,
      'Currency Code': row['Currency'] || '',
      'Exchange Rate': row['Exchange rate'] || '',
      'Quantity': row['Line_Quantity'] ||''
    });
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_vendorcredit_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);

  const newWb = utils.book_new();
  const newWs = utils.json_to_sheet(finalRows);
  utils.book_append_sheet(newWb, newWs, 'Vendor Credits');
  writeFile(newWb, outputPath);

  console.log('✅ Vendor Credit file converted:', outputPath);
  return outputPath;
};

// Convert Handler
const handleVendorCreditConvert = (req, res) => {
  try {
    const outputPath = convertVendorCredit();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Download Handler
const downloadVendorCredit = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_vendorcredit_') && file.endsWith('.xlsx'))
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

// Export Handlers
export {
  handleVendorCreditUpload,
  handleVendorCreditConvert,
  downloadVendorCredit,
  upload
};

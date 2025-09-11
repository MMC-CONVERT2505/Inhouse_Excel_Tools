import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ File paths
let uploadedInvoicePath = '';
let uploadedCoaPath = '';
let uploadedTaxPath = '';
let uploadedItemPath = '';

// ✅ Format date ➝ dd/mm/yyyy
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

// ✅ Read Excel into JSON
function readSheet(filePath) {
  const wb = readFile(filePath);
  return utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}

// ✅ Tax Mapping
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

// ✅ Upload Directory Setup
const uploadDir = join('uploads', 'supplierbill');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${file.fieldname}_${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// ✅ Upload Handler
const handleSupplierBillUpload = (req, res) => {
  try {
    if (
      !req.files || !req.files.invoice ||
      !req.files.coa || !req.files.tax ||
      !req.files.item
    ) {
      return res.status(400).json({ message: 'All 4 files (invoice, coa, tax, item) are required' });
    }

    uploadedInvoicePath = req.files.invoice[0].path;
    uploadedCoaPath = req.files.coa[0].path;
    uploadedTaxPath = req.files.tax[0].path;
    uploadedItemPath = req.files.item[0].path;

    console.log('✅ Supplier Bill Invoice path:', uploadedInvoicePath);
    console.log('✅ COA path:', uploadedCoaPath);
    console.log('✅ Tax path:', uploadedTaxPath);
    console.log('✅ Item path:', uploadedItemPath);

    res.status(200).json({ message: 'Files uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Convert Function
// ✅ Convert Function
const convertSupplierBill = () => {
  if (
    !fs.existsSync(uploadedInvoicePath) ||
    !fs.existsSync(uploadedCoaPath) ||
    !fs.existsSync(uploadedTaxPath) ||
    !fs.existsSync(uploadedItemPath)
  ) {
    throw new Error('Missing one or more uploaded files');
  }

  const invoiceData = readSheet(uploadedInvoicePath);
  const coaData = readSheet(uploadedCoaPath);
  const taxData = readSheet(uploadedTaxPath);
  const itemData = readSheet(uploadedItemPath);

  const finalRows = [];

  // ✅ Helper to convert to real Excel Date
  function excelDate(value) {
    try {
      let date;
      if (typeof value === 'number') {
        const utcDays = value - 25569;
        const utcValue = utcDays * 86400;
        date = new Date(utcValue * 1000);
      } else {
        date = new Date(value);
      }
      if (isNaN(date.getTime())) return null;
      return date;
    } catch {
      return null;
    }
  }

  invoiceData.forEach(row => {
    const quantity = row['Line_Quantity'] || 1;
    const rate = row['Line_UnitPriceExclusive'] || 0;
    const amount = +(quantity * rate).toFixed(2);
    const lineType = row['LineType'];
    const selId = row['Line_SelectionId'];

    // ✅ Get expense account from COA or Item
    let account = 'Unknown';
    if (lineType === 1) {
      const match = coaData.find(acc => acc.ID === selId);
      account = match ? match.Name : 'Unknown Account';
    } else if (lineType === 0) {
      const itemMatch = itemData.find(item => String(item.ID) === String(selId));
      account = itemMatch
        ? itemMatch['Code'] || itemMatch['Description'] || 'Unknown Item'
        : 'Unknown Item';
    }

    // ✅ Tax Mapping
    let taxCode = 'Out of Scope';
    const taxTypeId = row['Line_TaxTypeId'];
    if (taxTypeId !== '' && taxTypeId !== null && taxTypeId !== undefined) {
      const taxRow = taxData.find(t => t.ID === taxTypeId);
      if (taxRow) {
        const name = taxRow['Name']?.trim();
        taxCode = embeddedTaxMapping[name] || '';
      } else {
        taxCode = '';
      }
    }

    finalRows.push({
      'Bill No': String(row['DocumentNumber']).slice(0, 21),
      'Supplier': row['SupplierName'],
      'Bill Date': excelDate(row['Date']),   // ✅ Date object
      'Due Date': excelDate(row['DueDate']), // ✅ Date object
      'Memo': row['Message'] || '',
      'Global Tax Calculation': 'TaxExcluded',
      'Expense Account': account,
      'Expense Description': row['Line_Description'],
      'Expense Line Amount': amount,
      'Expense Class': '',
      'Expense Tax Code': taxCode || 'Out of Scope',
      'Expense Account Tax Amount': row['Line_Tax'] || 0,
      'Currency Code': row['Currency'] || '',
      'Exchange Rate': row['Exchange rate'] || '',
      'Quantity': row['Line_Quantity'] || ''
    });
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_supplierbill_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);

  const newWb = utils.book_new();
  const newWs = utils.json_to_sheet(finalRows, { cellDates: true });

  // ✅ Apply column widths
  newWs['!cols'] = [
    { wch: 15 }, // Bill No
    { wch: 25 }, // Supplier
    { wch: 12 }, // Bill Date
    { wch: 12 }, // Due Date
  ];

  // ✅ Force date formatting (dd/mm/yyyy)
  Object.keys(newWs).forEach(cell => {
    if (cell.startsWith('C') || cell.startsWith('D')) { // C = Bill Date, D = Due Date
      if (newWs[cell] && newWs[cell].v instanceof Date) {
        newWs[cell].t = 'd';
        newWs[cell].z = 'dd/mm/yyyy';
      }
    }
  });

  utils.book_append_sheet(newWb, newWs, 'Supplier Bills');
  writeFile(newWb, outputPath);

  console.log('✅ Supplier Bill converted:', outputPath);
  return outputPath;
};


// ✅ Convert Handler
const handleSupplierBillConvert = (req, res) => {
  try {
    const outputPath = convertSupplierBill();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadSupplierBill = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_supplierbill_') && file.endsWith('.xlsx'))
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

// ✅ Export
export {
  handleSupplierBillUpload,
  handleSupplierBillConvert,
  downloadSupplierBill,
  upload
};

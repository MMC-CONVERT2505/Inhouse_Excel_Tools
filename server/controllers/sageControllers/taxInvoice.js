import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedInvoicePath = '';
let uploadedItemPath = '';
let uploadedCoaPath = '';
let uploadedTaxPath = '';

// ✅ Format Excel date
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

// ✅ Upload Dir Setup
const uploadDir = join('uploads', 'taxinvoice');
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
const handleTaxInvoiceUpload = (req, res) => {
  try {
    if (
      !req.files || !req.files.invoice ||
      !req.files.item || !req.files.coa || !req.files.tax
    ) {
      return res.status(400).json({ message: 'All 4 files (invoice, item, coa, tax) are required' });
    }

    uploadedInvoicePath = req.files.invoice[0].path;
    uploadedItemPath = req.files.item[0].path;
    uploadedCoaPath = req.files.coa[0].path;
    uploadedTaxPath = req.files.tax[0].path;

    console.log('✅ Invoice path:', uploadedInvoicePath);
    console.log('✅ Item path:', uploadedItemPath);
    console.log('✅ COA path:', uploadedCoaPath);
    console.log('✅ Tax path:', uploadedTaxPath);

    res.status(200).json({ message: 'Files uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Convert Function
const convertTaxInvoice = () => {
  if (
    !fs.existsSync(uploadedInvoicePath) ||
    !fs.existsSync(uploadedItemPath) ||
    !fs.existsSync(uploadedCoaPath) ||
    !fs.existsSync(uploadedTaxPath)
  ) {
    throw new Error('Missing one or more uploaded files');
  }

  const invoiceData = readSheet(uploadedInvoicePath);
  const itemData = readSheet(uploadedItemPath);
  const coaData = readSheet(uploadedCoaPath);
  const taxData = readSheet(uploadedTaxPath);

  const finalRows = [];

  invoiceData.forEach(row => {
    const quantity = row['Line_Quantity'] || 1;
    const rate = row['Line_UnitPriceExclusive'] || 0;
    const amount = +(quantity * rate).toFixed(2);
    const taxAmt = row['Line_Tax'] || 0;

    const lineType = row['LineType'];
    const selId = row['Line_SelectionId'];

    let product = '';
    if (lineType === 0) {
      const match = itemData.find(i => i.ID === selId);
      product = match ? match.Code : 'Unknown Item';
    } else {
      const match = coaData.find(c => c.ID === selId);
      product = match ? match.Name : 'Unknown Account';
    }

    const taxMatch = taxData.find(t => t.ID === row['Line_TaxTypeId']);
    let taxCode = taxMatch ? taxMatch.Name : 'Out of Scope';
    taxCode = taxCode.replace(/\bRate\b/gi, '').trim();  // ✅ VALID



    finalRows.push({
      'Invoice No': String(row['DocumentNumber']).slice(0, 21),
      'Customer': row['CustomerName'],
      'Invoice Date': new Date(row['Date']),
      'Due Date': new Date(row['DueDate']),
      'Global Tax Calculation': 'TaxExcluded',
      'Product/Service': product,
      'Product/Service Description': row['Line_Description'],
      'Product/Service Quantity': quantity,
      'Product/Service Rate': rate,
      'Product/Service Amount': row['Line_Exclusive'],
      'Product/Service Tax Code': taxCode,
      'Product/Service Tax Amount': taxAmt,
      'Product/Service Class': '',
      'Currency Code': row['Currency'],
      'Exchange Rate': row['Exchange rate'],
      'Discount Percent': row['DiscountPercentage'],
      'Memo on statement': row['Message']
    });
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_taxinvoice_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);

  const newWb = utils.book_new();
  const newWs = utils.json_to_sheet(finalRows);
  utils.book_append_sheet(newWb, newWs, 'Invoices');
  writeFile(newWb, outputPath);

  console.log('✅ Tax Invoice converted:', outputPath);
  return outputPath;
};

// ✅ Convert Handler
const handleTaxInvoiceConvert = (req, res) => {
  try {
    const outputPath = convertTaxInvoice();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadTaxInvoice = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_taxinvoice_') && file.endsWith('.xlsx'))
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
  handleTaxInvoiceUpload,
  handleTaxInvoiceConvert,
  downloadTaxInvoice,
  upload
};

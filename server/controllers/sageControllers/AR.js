import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile, SSF } = xlsx; // ✅ SSF added
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedARPath = '';

// ✅ Clean values
function cleanValue(value) {
  if (value === undefined || value === null) return '';
  let str = String(value).trim();
  return str === '*' ? '' : str;
}

// ✅ Format to dd/mm/yyyy (robust: Excel serials, numeric strings, ISO, dd-mm-yyyy)
function formatDate(v) {
  try {
    if (v === undefined || v === null || v === '') return '';

    // Excel serial (number)
    if (typeof v === 'number') {
      const d = SSF.parse_date_code(v);
      if (!d) return '';
      const dd = String(d.d || 1).padStart(2, '0');
      const mm = String(d.m || 1).padStart(2, '0');
      const yyyy = d.y || new Date().getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    // Strings
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return '';

      // numeric string → treat as Excel serial
      if (/^\d+(\.\d+)?$/.test(s)) {
        const num = Number(s);
        const d = SSF.parse_date_code(num);
        if (d) {
          const dd = String(d.d || 1).padStart(2, '0');
          const mm = String(d.m || 1).padStart(2, '0');
          const yyyy = d.y || new Date().getFullYear();
          return `${dd}/${mm}/${yyyy}`;
        }
      }

      // dd/mm/yyyy or dd-mm-yyyy
      const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m1) {
        const ddn = parseInt(m1[1], 10);
        const mmn = parseInt(m1[2], 10);
        const yyyy = m1[3].length === 2 ? 2000 + parseInt(m1[3], 10) : parseInt(m1[3], 10);
        const d = new Date(yyyy, mmn - 1, ddn);
        if (!isNaN(d)) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          return `${dd}/${mm}/${yyyy}`;
        }
      }

      // ISO-like strings
      const iso = new Date(s);
      if (!isNaN(iso)) {
        const dd = String(iso.getDate()).padStart(2, '0');
        const mm = String(iso.getMonth() + 1).padStart(2, '0');
        const yyyy = iso.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
      return '';
    }

    // Date object fallback
    const d = new Date(v);
    if (isNaN(d)) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return '';
  }
}

// ✅ Upload folder
const uploadDir = join('uploads', 'ar');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, 'ar_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// ✅ Upload Handler
const handleARUpload = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    uploadedARPath = req.file.path;
    console.log('✅ AR File uploaded:', uploadedARPath);
    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Conversion Function
const convertAR = () => {
  if (!uploadedARPath || !fs.existsSync(uploadedARPath)) {
    throw new Error('No uploaded AR file found for conversion');
  }

  const workbook = readFile(uploadedARPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json(worksheet, { defval: '' });

  const invoiceRows = [];
  const creditMemoRows = [];

  const invoiceHeaders = [
    'Invoice No', 'Customer', 'Invoice Date', 'Due Date', 'Product/Service',
    'Product/Service Description', 'Product/Service Quantity',
    'Product/Service Rate', 'Product/Service Amount',
    'Currency Code', 'Exchange Rate'
  ];

  const creditMemoHeaders = [
    'Adjustment Note No', 'Customer', 'Adjustment Note Date', 'Product/Service',
    'Product/Service Description', 'Product/Service Quantity',
    'Product/Service Rate', 'Product/Service Amount',
    'Currency Code', 'Exchange Rate'
  ];

  rows.forEach((row, index) => {
    const docType = parseInt(row['Line_DocumentTypeId']);
    const amountRaw = row['Line_Total'];
    const amount = isNaN(parseFloat(amountRaw)) ? 0 : parseFloat(amountRaw);

    const docNumber = cleanValue(row['Line_DocumentNumber']);
    const customer = cleanValue(row['Customer']);
    const comment = cleanValue(row['Line_Comment']);
    const lineDate = formatDate(row['Line_Date']);     // ✅ dd/mm/yyyy
    const dueDate = formatDate(row['Line_DueDate']);   // ✅ dd/mm/yyyy

    const common = {
      'Customer': customer,
      'Product/Service': 'Sales',
      'Product/Service Description': comment,
      'Product/Service Quantity': 1,
      'Product/Service Rate': Math.abs(amount),
      'Product/Service Amount': Math.abs(amount),
      'Currency Code': '',
      'Exchange Rate': ''
    };

    let classified = false;

    if (docType === 2) {
      // Invoice
      invoiceRows.push({
        'Invoice No': docNumber,
        'Customer': customer,
        'Invoice Date': lineDate,
        'Due Date': dueDate,
        ...common
      });
      classified = true;
    } else if ([3, 4, 9].includes(docType)) {
      // Treat as Credit Memo only if amount negative
      if (amount < 0) {
        creditMemoRows.push({
          'Adjustment Note No': docNumber,
          'Customer': customer,
          'Adjustment Note Date': lineDate,
          ...common
        });
      } else {
        invoiceRows.push({
          'Invoice No': docNumber,
          'Customer': customer,
          'Invoice Date': lineDate,
          'Due Date': dueDate,
          ...common
        });
      }
      classified = true;
    }

    if (!classified) {
      if (amount >= 0) {
        console.warn(`⚠️ Row ${index + 1} auto-classified as Invoice`);
        invoiceRows.push({
          'Invoice No': docNumber,
          'Customer': customer,
          'Invoice Date': lineDate,
          'Due Date': dueDate,
          ...common
        });
      } else {
        console.warn(`⚠️ Row ${index + 1} auto-classified as Credit Memo`);
        creditMemoRows.push({
          'Adjustment Note No': docNumber,
          'Customer': customer,
          'Adjustment Note Date': lineDate,
          ...common
        });
      }
    }
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const newWb = utils.book_new();

  if (invoiceRows.length > 0) {
    const invoiceSheet = utils.json_to_sheet(invoiceRows, { header: invoiceHeaders });
    utils.book_append_sheet(newWb, invoiceSheet, 'Invoices');
  }

  if (creditMemoRows.length > 0) {
    const creditMemoSheet = utils.json_to_sheet(creditMemoRows, { header: creditMemoHeaders });
    utils.book_append_sheet(newWb, creditMemoSheet, 'Credit Memos');
  }

  const outputFileName = 'converted_ar_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);
  writeFile(newWb, outputPath);
  console.log('✅ AR file converted:', outputPath);
  return outputPath;
};

// ✅ Convert Handler
const handleARConvert = (req, res) => {
  try {
    const outputPath = convertAR();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion failed:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadAR = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_ar_') && file.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtime - fs.statSync(join(convertedDir, a)).mtime);

    if (files.length === 0) {
      return res.status(404).json({ message: 'No converted AR file found' });
    }

    const latestFile = files[0];
    const filePath = join(convertedDir, latestFile);
    res.download(filePath, latestFile);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ message: 'Download failed' });
  }
};

// ✅ EXPORT
export {
  handleARUpload,
  handleARConvert,
  downloadAR,
  upload
};

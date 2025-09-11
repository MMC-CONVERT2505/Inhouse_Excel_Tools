import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { utils, writeFile } = xlsx;

// Global variable to store uploaded file path
let uploadedCustomerFilePath = '';

// Mapping from SageOne to QBO
const sageoneToQboColumnMapping = {
  'Name': 'Display Name As',
  'Opening Balance': 'Opening balance',
  'Opening Balance Date': 'As of',
  'Postal Address Line 1': 'Billing Address Line 1',
  'Postal Address Line 2': 'Billing Address City',
  'Postal Address Line 3': 'Billing Address Country Subdivision Code',
  'Postal Address Line 4': 'Billing Address Country',
  'Postal Address Postal Code': 'Billing Address Postal Code',
  'Delivery Address Line 1': 'Shipping Address Line 1',
  'Delivery Address Line 2': 'Shipping Address City',
  'Delivery Address Line 3': 'Shipping Address Country Subdivision Code',
  'Delivery Address Line 4': 'Shipping Address Country',
  'Delivery Address Postal Code': 'Shipping Address Postal Code',
  'Telephone Number': 'Phone',
  'Fax Number': 'Fax',
  'Cell Number': 'Mobile',
  'Email Address': 'Email',
  'Web Address': 'Website',
  'VAT Reference': 'Tax Resale No',
  'Currency': 'Currency code',
};

const allowedCustomerColumns = [
  'Display Name As', 'Opening balance', 'As of',
  'Billing Address Line 1', 'Billing Address City', 'Billing Address Country Subdivision Code', 'Billing Address Country', 'Billing Address Postal Code',
  'Shipping Address Line 1', 'Shipping Address City', 'Shipping Address Country Subdivision Code', 'Shipping Address Country', 'Shipping Address Postal Code',
  'Phone', 'Fax', 'Mobile', 'Email', 'Website', 'Tax Resale No'
];

const cleanValue = (val) => {
  if (!val || val === '*' || val.toString().trim() === '') {
    return '';
  }
  return val.toString().trim();
};

// ✅ Date formatter for Excel serial or Date object ➝ dd/mm/yyyy
function formatExcelDate(value) {
  try {
    if (typeof value === 'number') {
      const utcDays = value - 25569;
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      const day = String(dateInfo.getDate()).padStart(2, '0');
      const month = String(dateInfo.getMonth() + 1).padStart(2, '0');
      const year = dateInfo.getFullYear();
      return `${day}/${month}/${year}`;
    } else if (Object.prototype.toString.call(value) === '[object Date]') {
      const day = String(value.getDate()).padStart(2, '0');
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const year = value.getFullYear();
      return `${day}/${month}/${year}`;
    } else {
      return cleanValue(value);
    }
  } catch (err) {
    console.error('Date format error:', err);
    return '';
  }
}

// 🟢 Upload File and Store Path
const uploadDir = join('uploads', 'customer');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = extname(file.originalname);
    cb(null, 'customer_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// ✅ 1. Upload Handler
const handleCustomerUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    uploadedCustomerFilePath = req.file.path;
    console.log('Uploaded path:', uploadedCustomerFilePath);
    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ 2. Convert Function
const convertCustomer = () => {
  if (!uploadedCustomerFilePath || !fs.existsSync(uploadedCustomerFilePath)) {
    throw new Error('No uploaded file found for conversion');
  }

  const workbook = xlsx.readFile(uploadedCustomerFilePath);
  const sheetName = workbook.SheetNames[0];
  const data = utils.sheet_to_json(workbook.Sheets[sheetName]);

  const convertedData = data.map(row => {
    const newRow = {};
    for (const [sageKey, qboKey] of Object.entries(sageoneToQboColumnMapping)) {
      if (sageKey === 'Opening Balance Date') {
        newRow[qboKey] = formatExcelDate(row[sageKey]); // ✅ Correctly format date
      } else {
        newRow[qboKey] = cleanValue(row[sageKey]);
      }
    }
    allowedCustomerColumns.forEach(col => {
      if (!newRow.hasOwnProperty(col)) {
        newRow[col] = '';
      }
    });
    return newRow;
  });

  const newWorkbook = utils.book_new();
  const newWorksheet = utils.json_to_sheet(convertedData, { header: allowedCustomerColumns });
  utils.book_append_sheet(newWorkbook, newWorksheet, 'Customers');

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_customer_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);
  writeFile(newWorkbook, outputPath);

  return outputPath;
};

// ✅ 2. Convert Handler
const handleCustomerConvert = (req, res) => {
  try {
    const outputPath = convertCustomer();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion failed:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ 3. Download Handler
const downloadCustomerSage = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_customer_') && file.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtime - fs.statSync(join(convertedDir, a)).mtime);

    if (files.length === 0) {
      return res.status(404).json({ message: 'No converted customer file found' });
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
  handleCustomerUpload,
  handleCustomerConvert,
  downloadCustomerSage,
  upload // ⬅️ export multer instance if needed in route
};

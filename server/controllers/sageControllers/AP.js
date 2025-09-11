import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedAPPath = '';

// 🔸 Clean string
function cleanValue(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

// 🔸 Format Excel date ➝ dd/mm/yyyy
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

// ✅ Upload folder
const uploadDir = join('uploads', 'ap');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, 'ap_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// ✅ Upload Handler
const handleAPUpload = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    uploadedAPPath = req.file.path;
    console.log('✅ Uploaded AP path:', uploadedAPPath);
    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Conversion Function
const convertAP = () => {
  if (!uploadedAPPath || !fs.existsSync(uploadedAPPath)) {
    throw new Error('No uploaded AP file found for conversion');
  }

  const workbook = readFile(uploadedAPPath);
  const sheetName = workbook.SheetNames[0];
  const rows = utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  const bills = [];
  const credits = [];

  rows.forEach(row => {
    const amount = parseFloat(row['Line_Total']) || 0;
    const isCredit = amount < 0;

    const common = {
      Supplier: cleanValue(row['Supplier']),
      DocNo: cleanValue(row['Line_DocumentNumber']),
      BillDate: formatDate(row['Line_Date']),
      DueDate: formatDate(row['Line_DueDate']) || formatDate(row['Line_Date']),
      Description: cleanValue(row['Line_Comment']),
      Amount: Math.abs(amount),
      Currency: '',
      ExchangeRate: '',
      AccountCode: 'Retained Earnings'
    };

    if (isCredit) {
      credits.push({
        'Ref No': common.DocNo,
        'Vendor': common.Supplier,
        'Payment Date': common.BillDate,
        'Expense Account': common.AccountCode,
        'Expense Description': common.Description,
        'Expense Line Amount': common.Amount,
        'Currency Code': common.Currency,
        'Exchange Rate': common.ExchangeRate
      });
    } else {
      bills.push({
        'Bill No': common.DocNo,
        'Supplier': common.Supplier,
        'Bill Date': common.BillDate,
        'Due Date': common.DueDate,
        'Expense Account': common.AccountCode,
        'Expense Description': common.Description,
        'Expense Line Amount': common.Amount,
        'Currency Code': common.Currency,
        'Exchange Rate': common.ExchangeRate
      });
    }
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const newWb = utils.book_new();

  if (bills.length > 0) {
    const billSheet = utils.json_to_sheet(bills);
    utils.book_append_sheet(newWb, billSheet, 'Bills');
  }

  if (credits.length > 0) {
    const creditSheet = utils.json_to_sheet(credits);
    utils.book_append_sheet(newWb, creditSheet, 'Bill Credits');
  }

  const outputFileName = 'converted_ap_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);
  writeFile(newWb, outputPath);

  console.log('✅ AP file converted:', outputPath);
  return outputPath;
};

// ✅ Convert Handler
const handleAPConvert = (req, res) => {
  try {
    const outputPath = convertAP();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion failed:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadAP = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_ap_') && file.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtime - fs.statSync(join(convertedDir, a)).mtime);

    if (files.length === 0) {
      return res.status(404).json({ message: 'No converted AP file found' });
    }

    const latestFile = files[0];
    const filePath = join(convertedDir, latestFile);
    res.download(filePath, latestFile);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ message: 'Download failed' });
  }
};

// ✅ Export all handlers
export {
  handleAPUpload,
  handleAPConvert,
  downloadAP,
  upload
};

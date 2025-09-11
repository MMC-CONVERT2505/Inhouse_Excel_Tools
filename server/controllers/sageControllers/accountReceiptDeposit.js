import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Upload Paths
let uploadedDepositPath = '';
let uploadedCoaPath = '';
let uploadedTaxPath = '';

// ✅ Format Excel date ➝ dd/mm/yyyy
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

// ✅ Embedded Tax Mapping
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
const uploadDir = join('uploads', 'accountreceipt');
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
const handleAccountReceiptUpload = (req, res) => {
  try {
    if (!req.files || !req.files.deposit || !req.files.coa || !req.files.tax) {
      return res.status(400).json({ message: 'All 3 files (deposit, coa, tax) are required' });
    }

    uploadedDepositPath = req.files.deposit[0].path;
    uploadedCoaPath = req.files.coa[0].path;
    uploadedTaxPath = req.files.tax[0].path;

    console.log('✅ Deposit:', uploadedDepositPath);
    console.log('✅ COA:', uploadedCoaPath);
    console.log('✅ Tax:', uploadedTaxPath);

    res.status(200).json({ message: 'Files uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Convert Logic
const convertAccountReceipt = () => {
  if (!fs.existsSync(uploadedDepositPath) || !fs.existsSync(uploadedCoaPath) || !fs.existsSync(uploadedTaxPath)) {
    throw new Error('Missing one or more uploaded files');
  }

  const depositData = readSheet(uploadedDepositPath);
  const coaData = readSheet(uploadedCoaPath);
  const taxData = readSheet(uploadedTaxPath);

  const finalRows = [];

  depositData.forEach(row => {
    const bankMatch = coaData.find(acc => acc.ID === row['BankAccountId']);
    const depositToAccount = bankMatch ? bankMatch.Name : 'Unknown Bank Account';

    const accMatch = coaData.find(acc => acc.ID === row['AccountId']);
    const lineAccount = accMatch ? accMatch.Name : 'Unknown Line Account';

    const taxRow = taxData.find(t => t.ID === row['TaxTypeId']);
    const sageTaxName = taxRow?.Name?.trim();
    const taxCode = embeddedTaxMapping[sageTaxName] || 'Out of Scope';

    const taxAmount = row['Tax'] || 0;

    const fullRef = `${row['ID'] || ''}_${row['Reference'] || ''}`;
    const trimmedRef = fullRef.length > 21 ? fullRef.slice(0, 21) : fullRef;

    finalRows.push({
      'Ref No': trimmedRef,
      'Date': formatDate(row['Date']),
      'Deposit To Account': depositToAccount,
      'Received From': row['Payee'],
      'Memo': row['Comments'],
      'Global Tax Calculation': 'TaxExcluded',
      'Line Account': lineAccount,
      'Line Description': row['Description'],
      'Line Amount': row['Exclusive'],
      'Line Class': '',
      'Line Tax Code': taxCode,
      'Line Tax Amount': taxAmount,
      'Currency Code': row['Currency Code'],
      'Exchange Rate': row['Exchange Rate']
    });
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_accountreceipt_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);

  const newWb = utils.book_new();
  const newWs = utils.json_to_sheet(finalRows);
  utils.book_append_sheet(newWb, newWs, 'Account Receipt');
  writeFile(newWb, outputPath);

  console.log('✅ Account Receipt converted:', outputPath);
  return outputPath;
};

// ✅ Convert Handler
const handleAccountReceiptConvert = (req, res) => {
  try {
    const outputPath = convertAccountReceipt();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadAccountReceipt = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_accountreceipt_') && file.endsWith('.xlsx'))
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

// ✅ Export All
export {
  handleAccountReceiptUpload,
  handleAccountReceiptConvert,
  downloadAccountReceipt,
  upload
};

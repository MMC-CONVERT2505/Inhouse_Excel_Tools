import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedOpeningPath = '';

// ✅ Format Excel date ➝ dd/mm/yyyy
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

// ✅ Setup Upload Folder
const uploadDir = join('uploads', 'opening');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, 'opening_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// ✅ Upload Handler
const handleOpeningUpload = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    uploadedOpeningPath = req.file.path;
    console.log('Uploaded Opening Balance path:', uploadedOpeningPath);
    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Convert Function
const convertOpeningBalance = () => {
  if (!uploadedOpeningPath || !fs.existsSync(uploadedOpeningPath)) {
    throw new Error('No uploaded file found for conversion');
  }

const workbook = readFile(uploadedOpeningPath);
const sheetName = workbook.SheetNames[0];
const openingData = utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  const finalRows = [];

  openingData.forEach(row => {
    let account = row['Name'] || '';
    const debit = parseFloat(row['Debit']) || 0;
    const credit = parseFloat(row['Credit']) || 0;
    const currency = row['Currency'] || '';
    const rate = row['Exchange Rate'] || '';

    // ✅ Normalize account
    const norm = account.toLowerCase();
    if (norm.includes('trade receivables') || norm.includes('trade payables')) {
      account = 'Retained Earnings';
    }

    const amount = +(debit - credit).toFixed(2);

    finalRows.push({
      'Journal No': 'Opening Balance',
      'Journal Date': '', // Left blank for manual entry
      'Account': account,
      'Amount': amount,
      'Currency Code': currency,
      'Exchange Rate': rate
    });
  });

  const newWb = utils.book_new();
  const newWs = utils.json_to_sheet(finalRows);
  utils.book_append_sheet(newWb, newWs, 'Opening Balance');

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_opening_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);
  writeFile(newWb, outputPath);

  console.log('✅ Opening Balance converted:', outputPath);
  return outputPath;
};

// ✅ Convert Handler
const handleOpeningConvert = (req, res) => {
  try {
    const outputPath = convertOpeningBalance();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion failed:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadOpening = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_opening_') && file.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtime - fs.statSync(join(convertedDir, a)).mtime);

    if (files.length === 0) {
      return res.status(404).json({ message: 'No converted opening balance file found' });
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
  handleOpeningUpload,
  handleOpeningConvert,
  downloadOpening,
  upload
};

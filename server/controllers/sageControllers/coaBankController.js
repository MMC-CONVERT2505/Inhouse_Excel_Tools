import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedCoaPath = '';
let uploadedBankPath = '';

// ✅ Output Columns
const allowedColumns = [
  'Account Name', 'Type', 'Detail Type', 'Description', 'Tax',
  'Opening Balance', 'Opening Balance Date', 'Currency'
];

// ✅ Normalize value
function normalize(value) {
  return (value || '').toString().trim().toLowerCase();
}

// ✅ Read Excel into JSON
function readSheet(filePath) {
  const wb = readFile(filePath);
  return utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}

// ✅ Reorder Columns
function reorderColumns(row, columnOrder) {
  const newRow = {};
  columnOrder.forEach(col => {
    newRow[col] = row[col] || '';
  });
  return newRow;
}

// ✅ Upload Dir Setup
const uploadDir = join('uploads', 'coa');
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
const handleCoaUpload = (req, res) => {
  try {
    if (!req.files || !req.files.coa || !req.files.bankcard) {
      return res.status(400).json({ message: 'Both COA and BankCard files are required' });
    }

    uploadedCoaPath = req.files.coa[0].path;
    uploadedBankPath = req.files.bankcard[0].path;

    console.log('✅ COA path:', uploadedCoaPath);
    console.log('✅ BankCard path:', uploadedBankPath);

    res.status(200).json({ message: 'Files uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Convert Function
const convertChartOfAccounts = () => {
  if (!fs.existsSync(uploadedCoaPath) || !fs.existsSync(uploadedBankPath)) {
    throw new Error('Missing uploaded COA or BankCard file');
  }

  const coaData = readSheet(uploadedCoaPath);
  const bankCardData = readSheet(uploadedBankPath);

  const bankNamesSet = new Set();
  bankCardData.forEach(row => {
    if (row['Name']) bankNamesSet.add(normalize(row['Name']));
  });

  const finalRows = [];

  coaData.forEach(row => {
    const name = (row['Name'] || '').toString().trim();
    const category = normalize(row['Category'] || '');
    const accountVal = normalize(name);
    const isBankOrCard = bankNamesSet.has(accountVal);

    const resultRow = {
      'Account Name': name,
      'Description': row['Description'] || '',
      'Tax': '',
      'Opening Balance': row['Balance'] || '',
      'Opening Balance Date': '',
      'Currency': ''
    };

    // ✅ Type + Detail Type Logic
    if (isBankOrCard) {
      if (name.includes('*') || (row['Account Number'] || '').toString().includes('*')) {
        resultRow['Type'] = 'Credit Card';
        resultRow['Detail Type'] = 'Credit Card';
      } else {
        resultRow['Type'] = 'Cash and cash equivalents';
        resultRow['Detail Type'] = 'Bank';
      }
    } else {
      if (accountVal.includes('income tax')) {
        resultRow['Type'] = 'Income';
        resultRow['Detail Type'] = 'Revenue - General';
      } else if (accountVal === 'inventory') {
        resultRow['Type'] = 'Current assets';
        resultRow['Detail Type'] = 'Other current assets';
      } else if (accountVal === 'trade payables') {
        resultRow['Type'] = 'Accounts Payable (A/P)';
        resultRow['Detail Type'] = 'Accounts Payable (A/P)';
      } else if (accountVal === 'trade receivables') {
        resultRow['Type'] = 'Account Receivables (A/R)';
        resultRow['Detail Type'] = 'Account Receivables (A/R)';
      } else if (category === 'owners equity') {
        resultRow['Type'] = 'Owners Equity';
        resultRow['Detail Type'] = 'Owners Equity';
      } else if (category === 'non-current assets') {
        resultRow['Type'] = 'non-Current Assets';
        resultRow['Detail Type'] = 'Other non-current assets';
      } else if (category === 'current liabilities') {
        resultRow['Type'] = 'Current Liabilities';
        resultRow['Detail Type'] = 'Other Current Liabilities';
      } else if (category === 'current assets') {
        resultRow['Type'] = 'Current assets';
        resultRow['Detail Type'] = 'Other current assets';
      } else if (category === 'expenses') {
        resultRow['Type'] = 'Expenses';
        resultRow['Detail Type'] = 'Other Miscellaneous Service Cost';
      } else if (category === 'non-current liabilities') {
        resultRow['Type'] = 'Non-current liabilities';
        resultRow['Detail Type'] = 'Other non-current liabilities';
      } else if (category === 'other income') {
        resultRow['Type'] = 'Other income';
        resultRow['Detail Type'] = 'Other Miscellaneous Income';
      } else if (category === 'sales') {
        resultRow['Type'] = 'Income';
        resultRow['Detail Type'] = 'Revenue - General';
      } else if (category === 'cost of sales') {
        resultRow['Type'] = 'Cost of Sales';
        resultRow['Detail Type'] = 'Supplies and materials';
      } else {
        resultRow['Type'] = '';
        resultRow['Detail Type'] = '';
      }
    }

    finalRows.push(reorderColumns(resultRow, allowedColumns));
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_coa_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);

  const newWb = utils.book_new();
  const newWs = utils.json_to_sheet(finalRows);
  utils.book_append_sheet(newWb, newWs, 'Chart of Accounts');
  writeFile(newWb, outputPath);

  console.log('✅ COA File converted:', outputPath);
  return outputPath;
};

// ✅ Convert Handler
const handleCoaConvert = (req, res) => {
  try {
    const outputPath = convertChartOfAccounts();
    res.status(200).json({ message: 'Conversion successful', path: outputPath });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadCoa = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_coa_') && file.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtime - fs.statSync(join(convertedDir, a)).mtime);

    if (files.length === 0) {
      return res.status(404).json({ message: 'No converted COA file found' });
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
  handleCoaUpload,
  handleCoaConvert,
  downloadCoa,
  upload
};

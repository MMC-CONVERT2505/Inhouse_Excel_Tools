import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import xlsx from 'xlsx';
import { parse } from 'json2csv';

// Setup __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData = []; 

const fieldMapping = {
  'BankTransferID': 'Reference',
  'Date': 'Date',
  'FromBankAccName': 'From Account',
  'ToBankAccName': 'To Account',    
  'Amount': 'Amount',
  'CurrencyRate': 'CurrencyRate'
};

const baseColumns = [
  'Reference',
  'Date',
  'From Account',
  'To Account',
  'Amount',
  'CurrencyRate'
];

let currencyRatePresent = false;

function formatDate(input) {
  const date = new Date(input);
  if (isNaN(date.getTime())) return input;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function renameFields(row) {
  const newRow = {};
  for (const key in row) {
    const trimmedKey = key.trim();
    const newKey = fieldMapping[trimmedKey];
    if (newKey) {
      newRow[newKey] = row[key];
    }
  }
  return newRow;
}

function transformInvoiceFields(originalRow) {
  const transformed = renameFields(originalRow);

  // Format Date
  if (transformed['Date']) {
    transformed['Date'] = formatDate(transformed['Date']);
  }

  // Build Reference using BankTransferID
  const rawBankTransferID = originalRow['BankTransferID'] || '';
  const trimmedBankTransferID = rawBankTransferID.split('-')[0];
  const originalReference = originalRow['Reference'] || '';

  transformed['Reference'] = originalReference
    ? `Trf_${trimmedBankTransferID}-${originalReference}`
    : `Trf_${trimmedBankTransferID}`;

  return transformed;
}

function transformData(data) {
  return data.map(row => {
    const transformed = transformInvoiceFields(row);
    if (transformed['CurrencyRate']) currencyRatePresent = true;
    return transformed;
  });
}

// Upload Handler
const transferHandler = (req, res) => {
  uploadedData = [];
  currencyRatePresent = false;

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    unlinkSync(req.file.path);

    if (sheetData.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or invalid format.' });
    }
 
    uploadedData = sheetData;
    res.json({ message: 'Excel file uploaded and parsed successfully.' });
  } catch (err) {
    unlinkSync(req.file.path);
    res.status(500).json({ message: `Error reading Excel file: ${err.message}` });
  }
};

// Convert Handler
const transferConvert = (req, res) => {
  if (!uploadedData || uploadedData.length === 0) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  const transformed = transformData(uploadedData);
  const finalColumns = [...baseColumns];

  if (currencyRatePresent && !finalColumns.includes('CurrencyRate')) {
    finalColumns.push('CurrencyRate');
  }

  const normalizedRows = transformed.map(row => {
    const normalized = {};
    finalColumns.forEach(col => {
      normalized[col] = row[col] || '';
    });
    return normalized;
  });

  const csvString = parse(normalizedRows, { fields: finalColumns });

  const outputDir = join(__dirname, '../converted');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, 'converted.csv');
  writeFileSync(outputPath, csvString);

  res.json({ message: 'Data converted successfully.' });
};

// Download Handler
const transferDownload = (req, res) => {
  const file = join(__dirname, '../converted', 'converted.csv');
  if (existsSync(file)) {
    res.download(file, (err) => {
      if (err) {
        res.status(500).json({ message: 'Error downloading the file.' });
      }
    });
  } else {
    res.status(404).json({ message: 'Converted file not found' });
  }
};

export {
  transferHandler,
  transferConvert,
  transferDownload
};

import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { parse } from 'json2csv';

// ✅ Define __dirname manually for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData = [];

const fieldMapping = {
  'Date': 'Date',
  'LineAmount': 'Amount',
  'Description': 'Description',
  'Name': 'Payee',
  'ContactName': 'Payee',
  'BankTransactionID': 'BankTransactionID',
  'Type': 'Transaction type',
  'AccountCode': 'Account Code',
  'TaxType': 'Tax', // Mapping TaxType to Tax directly
  'BankAccountCode': 'Bank',
  'CurrencyCode': 'Currency rate',
  'LineAmountTypes': 'Line Amount Type',
  'Tname': 'Tname',
  'Toption': 'Toption',
  'Tname1': 'Tname1',
  'Toption1': 'Toption1',
  'Item Code': 'Item Code',
  'Reference': 'Reference',
  'TaxAmount': 'TaxAmount'
};

const baseColumns = [
  'Date', 'Amount', 'Description', 'Payee', 'Reference',
  'Transaction type', 'Account Code', 'Tax', 'Bank', 'Line Amount Type', 'TaxAmount'
];

let optionalTrackingFields = new Set();
let itemCodePresent = false;
let currencyRatePresent = false;

const applyTaxMapping = (row) => {
  const taxCodeMap = {
    'BASEXCLUDED': 'BAS Excluded',
    'EXEMPTEXPENSES': 'GST Free Expenses',
    'EXEMPTOUTPUT': 'GST Free Income',
    'INPUT': 'GST on Expenses',
    'OUTPUT': 'GST on Income',
    'BAS EXCLUDED': 'BAS Excluded',
    'GST FREE EXPENSES': 'GST Free Expenses',
    'GST FREE INCOME': 'GST Free Income',
    'GST ON EXPENSES': 'GST on Expenses',
    'GST ON INCOME': 'GST on Income'
  };

  let tax = row['Tax']?.toString().toUpperCase().trim();
  if (tax && taxCodeMap[tax]) {
    row['Tax'] = taxCodeMap[tax];
  } else {
    row['Tax'] = 'BAS Excluded';
  }
  return row;
};

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

function formatDateToDDMMYYYY(dateObj) {
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

function transformInvoiceFields(row) {
  const transformed = { ...row };
  const dateValue = row['Date'];

  if (typeof dateValue === 'number') {
    const excelDate = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    transformed['Date'] = formatDateToDDMMYYYY(excelDate);
  } else if (typeof dateValue === 'string') {
    const parsedDate = new Date(dateValue);
    transformed['Date'] = isNaN(parsedDate) ? dateValue : formatDateToDDMMYYYY(parsedDate);
  } else {
    transformed['Date'] = '';
  }

  if (typeof transformed['Description'] !== 'string' || !transformed['Description'].trim()) {
    transformed['Description'] = '.';
  }

  if (!transformed['Payee']?.toString().trim()) {
    transformed['Payee'] = 'No Name';
  }

  const originalReference = row['Reference'] || '';
  const bankTransactionID = row['BankTransactionID'] || '';
  const trimmedBankTxn = bankTransactionID.split('-')[0];

  transformed['Reference'] = originalReference
    ? `Spend_${trimmedBankTxn}-${originalReference}`
    : `Spend_${trimmedBankTxn}`;

  transformed['Line Amount Type'] = 'Exclusive';

  return transformed;
}

function transformData(data) {
  return data.map(row => {
    const renamed = renameFields(row);
    const transformed = transformInvoiceFields(renamed);
    const finalRow = applyTaxMapping(transformed);

    if (finalRow['Tname']) optionalTrackingFields.add('Tname');
    if (finalRow['Toption']) optionalTrackingFields.add('Toption');
    if (finalRow['Tname1']) optionalTrackingFields.add('Tname1');
    if (finalRow['Toption1']) optionalTrackingFields.add('Toption1');

    if (finalRow['Item Code']) itemCodePresent = true;
    if (finalRow['Currency rate']) currencyRatePresent = true;

    return finalRow;
  });
}

const spendHandlerMulti = (req, res) => {
  uploadedData = [];
  optionalTrackingFields.clear();
  itemCodePresent = false;
  currencyRatePresent = false;

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: true });

    unlinkSync(req.file.path);

    if (!data.length) {
      return res.status(400).json({ message: 'Excel sheet is empty or invalid format.' });
    }

    uploadedData = data;
    res.json({ message: 'Excel file uploaded and parsed successfully.' });
  } catch (err) {
    if (req.file?.path) unlinkSync(req.file.path);
    res.status(500).json({ message: `Error processing Excel file: ${err.message}` });
  }
};

const spendConvertMulti = (req, res) => {
  if (!uploadedData.length) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  const transformed = transformData(uploadedData);
  const finalColumns = [...baseColumns];

  if (currencyRatePresent) finalColumns.push('Currency rate');
  if (itemCodePresent) finalColumns.push('Item Code');

  optionalTrackingFields.forEach(col => {
    if (!finalColumns.includes(col)) finalColumns.push(col);
  });

  const normalizedRows = transformed.map(row => {
    const normalized = {};
    finalColumns.forEach(col => {
      // ✅ Keep 0 values (especially for TaxAmount)
      normalized[col] = row[col] !== undefined ? row[col] : '';
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

const spendDownloadMulti = (req, res) => {
  const file = join(__dirname, '../converted/converted.csv');
  if (existsSync(file)) {
    res.download(file, 'converted.csv', err => {
      if (err) res.status(500).json({ message: 'Error downloading the file.' });
    });
  } else {
    res.status(404).json({ message: 'Converted file not found' });
  }
};

export {
  spendHandlerMulti,
  spendConvertMulti,
  spendDownloadMulti
}; 

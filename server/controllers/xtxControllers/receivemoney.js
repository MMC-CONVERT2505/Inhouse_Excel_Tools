import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { parse } from 'json2csv';

// ✅ Manual definition of __dirname for ESM
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
  'TaxType': 'Tax', // ✅ Maps to Tax
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
const excludedNames = [];

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

const applyTaxMapping = (row) => {
  const rawTax = row['Tax'];
  const accountType = row['Transaction type'];

  if (rawTax && typeof rawTax === 'string') {
    const upper = rawTax.trim().toUpperCase();
    if (taxCodeMap[upper]) {
      row['Tax'] = taxCodeMap[upper];
    } else {
      row['Tax'] = ['Expense', 'Other Income'].includes(accountType)
        ? 'BAS Excluded'
        : 'BAS Excluded';
    }
  } else {
    row['Tax'] = 'Tax Exempt';
  }
  return row;
};

function renameFields(row) {
  const newRow = {};
  for (const key in row) {
    const trimmedKey = key.trim();
    const mappedKey = fieldMapping[trimmedKey];

    if (mappedKey) {
      newRow[mappedKey] = row[key];
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

  const dateVal = row['Date'];
  if (typeof dateVal === 'number') {
    const excelDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    transformed['Date'] = formatDateToDDMMYYYY(excelDate);
  } else if (typeof dateVal === 'string') {
    const parsed = new Date(dateVal);
    transformed['Date'] = isNaN(parsed) ? dateVal : formatDateToDDMMYYYY(parsed);
  } else {
    transformed['Date'] = '';
  }

  transformed['Description'] =
    typeof transformed['Description'] === 'string' && transformed['Description'].trim()
      ? transformed['Description'].trim()
      : '.';

  if (!transformed['Payee']?.trim()) {
    transformed['Payee'] = 'No Name';
  }

  const reference = row['Reference'] || '';
  const txnId = row['BankTransactionID'] || '';
  const shortTxnId = txnId.split('-')[0];
  transformed['Reference'] = reference
    ? `Receive_${shortTxnId}-${reference}`
    : `Receive_${shortTxnId}`;

  transformed['Line Amount Type'] = 'Exclusive';

  return transformed;
}

function transformData(data) {
  return data
    .filter(row => !excludedNames.includes(row['Name']))
    .map(row => {
      let renamed = renameFields(row);
      renamed = transformInvoiceFields(renamed);
      renamed = applyTaxMapping(renamed);

      if (renamed['Tname']) optionalTrackingFields.add('Tname');
      if (renamed['Toption']) optionalTrackingFields.add('Toption');
      if (renamed['Tname1']) optionalTrackingFields.add('Tname1');
      if (renamed['Toption1']) optionalTrackingFields.add('Toption1');
      if (renamed['Item Code']) itemCodePresent = true;
      if (renamed['Currency rate']) currencyRatePresent = true;

      return renamed;
    });
}

const receiveHandler = (req, res) => {
  uploadedData = [];
  optionalTrackingFields = new Set();
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

const receiveConvert = (req, res) => {
  if (!uploadedData.length) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  const transformed = transformData(uploadedData);
  const finalColumns = [...baseColumns];

  if (currencyRatePresent && !finalColumns.includes('Currency rate')) finalColumns.push('Currency rate');
  if (itemCodePresent && !finalColumns.includes('Item Code')) finalColumns.push('Item Code');
  optionalTrackingFields.forEach(field => {
    if (!finalColumns.includes(field)) finalColumns.push(field);
  });

  const normalizedRows = transformed.map(row => {
    const normalized = {};
    finalColumns.forEach(col => {
      // ❗ preserve 0 values, nulls, and blanks
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

const receiveDownload = (req, res) => {
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
  receiveHandler,
  receiveConvert,
  receiveDownload
};

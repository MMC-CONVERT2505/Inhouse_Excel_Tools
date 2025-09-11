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
  'InvoiceNumber': 'InvoiceNumber',
  'Amount': 'Amount',
  'AccountCode': 'Bank',
  'Bill_ID': 'Bill_ID',
  'Reference': 'Reference',
  'CurrencyRate': 'CurrencyRate',
  'ContactName': 'ContactName'
};

const baseColumns = [
  'Date',
  'InvoiceNumber',
  'Amount',
  'Bank',
  'Reference',
  'CurrencyRate',
  'ContactName',
];

let optionalTrackingFields = new Set();
let ContactNamePresent = false;
let currencyRatePresent = false;
let itemCodePresent = false;

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

function transformInvoiceFields(row) {
  const transformed = { ...row };
  if (transformed['Date']) {
    transformed['Date'] = formatDate(transformed['Date']);
  }

  const billIdRaw = row['Bill_ID'] || '';
  const originalReference = row['Reference'] || '';
  const trimmedBillID = billIdRaw.split('-')[0];

  transformed['Reference'] = originalReference
    ? `Bill Payment_${trimmedBillID}-${originalReference}`
    : `Bill Payment_${trimmedBillID}`;

  return transformed;
}

function transformData(data) {
  return data.map(row => {
    const renamed = renameFields(row);
    const transformed = transformInvoiceFields(renamed);

    if (transformed['ContactName']) ContactNamePresent = true;
    if (transformed['CurrencyRate']) currencyRatePresent = true;

    return transformed;
  });
}

export const billpaymentHandler = (req, res) => {
  uploadedData = [];
  optionalTrackingFields = new Set();
  ContactNamePresent = false;
  currencyRatePresent = false;
  itemCodePresent = false;

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

export const billpaymentConvert = (req, res) => {
  if (!uploadedData || uploadedData.length === 0) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  const transformed = transformData(uploadedData);

  const finalColumns = [...baseColumns];

  if (currencyRatePresent && !finalColumns.includes('CurrencyRate')) {
    finalColumns.push('CurrencyRate');
  }

  if (itemCodePresent && !finalColumns.includes('Item Code')) {
    finalColumns.push('Item Code');
  }

  optionalTrackingFields.forEach(col => {
    if (!finalColumns.includes(col)) {
      finalColumns.push(col);
    }
  });

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

export const billpaymentDownload = (req, res) => {
  const file = join(__dirname, '../converted/converted.csv');
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



// import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';
// import xlsx from 'xlsx';
// import { parse } from 'json2csv';

// let uploadedData = [];

// const fieldMapping = {
//   'Date': 'Date',
//   'InvoiceNumber': 'InvoiceNumber',
//   'Amount': 'Amount',
//   'AccountCode': 'Bank',
//   'Bill_ID': 'Bill_ID',
//   'Reference': 'Reference',
//   'CurrencyRate': 'CurrencyRate',
//   'ContactName': 'ContactName'
// };

// const baseColumns = [
//   'Date',
//   'InvoiceNumber',
//   'Amount',
//   'Bank',
//   'Reference',
//   'CurrencyRate',
//   'ContactName',
// ];

// let optionalTrackingFields = new Set();
// let ContactNamePresent = false;
// let currencyRatePresent = false;
// let itemCodePresent = false;

// function formatDate(input) {
//   const date = new Date(input);
//   if (isNaN(date.getTime())) return input;
//   const day = String(date.getDate()).padStart(2, '0');
//   const month = String(date.getMonth() + 1).padStart(2, '0');
//   const year = date.getFullYear();
//   return `${day}/${month}/${year}`;
// }

// function renameFields(row) {
//   const newRow = {};
//   for (const key in row) {
//     const trimmedKey = key.trim();
//     const newKey = fieldMapping[trimmedKey];
//     if (newKey) {
//       newRow[newKey] = row[key];
//     }
//   }
//   return newRow;
// }

// function transformInvoiceFields(row) {
//   const transformed = { ...row };
//   if (transformed['Date']) {
//     transformed['Date'] = formatDate(transformed['Date']);
//   }

//   const billIdRaw = row['Bill_ID'] || '';
//   const originalReference = row['Reference'] || '';
//   const trimmedBillID = billIdRaw.split('-')[0];

//   transformed['Reference'] = originalReference
//     ? `Bill Payment_${trimmedBillID}-${originalReference}`
//     : `Bill Payment_${trimmedBillID}`;

//   return transformed;
// }

// function transformData(data) {
//   return data.map(row => {
//     const renamed = renameFields(row);
//     const transformed = transformInvoiceFields(renamed);

//     if (transformed['ContactName']) ContactNamePresent = true;
//     if (transformed['CurrencyRate']) currencyRatePresent = true;

//     return transformed;
//   });
// }

// export const billpaymentHandler = (req, res) => {
//   uploadedData = [];
//   optionalTrackingFields = new Set();
//   ContactNamePresent = false;
//   currencyRatePresent = false;
//   itemCodePresent = false;

//   if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

//   try {
//     const workbook = xlsx.readFile(req.file.path);
//     const sheetName = workbook.SheetNames[0];
//     const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

//     unlinkSync(req.file.path);

//     if (sheetData.length === 0) {
//       return res.status(400).json({ message: 'Excel file is empty or invalid format.' });
//     }

//     uploadedData = sheetData;
//     res.json({ message: 'Excel file uploaded and parsed successfully.' });
//   } catch (err) {
//     unlinkSync(req.file.path);
//     res.status(500).json({ message: `Error reading Excel file: ${err.message}` });
//   }
// };

// export const billpaymentConvert = (req, res) => {
//   if (!uploadedData || uploadedData.length === 0) {
//     return res.status(400).json({ message: 'No data to convert' });
//   }

//   const transformed = transformData(uploadedData);

//   const finalColumns = [...baseColumns];

//   if (currencyRatePresent && !finalColumns.includes('CurrencyRate')) {
//     finalColumns.push('CurrencyRate');
//   }

//   if (itemCodePresent && !finalColumns.includes('Item Code')) {
//     finalColumns.push('Item Code');
//   }

//   optionalTrackingFields.forEach(col => {
//     if (!finalColumns.includes(col)) {
//       finalColumns.push(col);
//     }
//   });

//   const normalizedRows = transformed.map(row => {
//     const normalized = {};
//     finalColumns.forEach(col => {
//       normalized[col] = row[col] || '';
//     });
//     return normalized;
//   });

//   const csvString = parse(normalizedRows, { fields: finalColumns });

//   const outputDir = join(__dirname, '../converted');
//   if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

//   const outputPath = join(outputDir, 'converted.csv');
//   writeFileSync(outputPath, csvString);

//   res.json({ message: 'Data converted successfully.' });
// };

// export const billpaymentDownload = (req, res) => {
//   const file = join(__dirname, '../converted/converted.csv');
//   if (existsSync(file)) {
//     res.download(file, (err) => {
//       if (err) {
//         res.status(500).json({ message: 'Error downloading the file.' });
//       }
//     });
//   } else {
//     res.status(404).json({ message: 'Converted file not found' });
//   }
// };

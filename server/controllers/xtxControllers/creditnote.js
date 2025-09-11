// import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
// import { join } from 'path';
// import csv from 'csv-parser';
// import { parse } from 'json2csv';
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';

// let uploadedData = [];

// // Get the current directory name (equivalent to __dirname in CommonJS)
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// const fieldMapping = {
//   'ContactName': 'ContactName',
//   'InvoiceNumber': 'InvoiceNumber',
//   'Reference': 'Reference',
//   'InvoiceDate': 'InvoiceDate',
//   'DueDate': 'DueDate',
//   'InventoryItemCode': 'InventoryItemCode',
//   'Description': 'Description',
//   'Quantity': 'Quantity',
//   'UnitAmount': 'UnitAmount',
//   'Discount': 'Discount',
//   'LineAmount': 'LineAmount',
//   'AccountCode': 'AccountCode',
//   'TaxType': 'TaxType',
//   'TaxAmount': 'TaxAmount',
//   'TrackingName1': 'TrackingName1',
//   'TrackingOption1': 'TrackingOption1',
//   'TrackingName2': 'TrackingName2',
//   'TrackingOption2': 'TrackingOption2',
//   'Currency': 'Currency',
//   'Exchange rate': 'Exchange rate',
//   'Status': 'Status',
//   'Total': 'Total'
// };

// const allowedColumn = [
//   "ContactName", "InvoiceNumber", "Reference", "InvoiceDate", "DueDate", "InventoryItemCode",
//   "Description", "Quantity", "UnitAmount", "LineAmount", "AccountCode", "TaxType", "TaxAmount",
//   "TrackingName1", "TrackingOption1", "TrackingName2", "TrackingOption2",
//   "Currency", "Exchange rate", "LineAmountTypes", "Status", "Total", "Type"
// ];

// // Rename fields according to mapping
// function renameFields(row) {
//   const newRow = {};
//   for (const key in row) {
//     const trimmedKey = key.trim();
//     const newKey = fieldMapping[trimmedKey] || trimmedKey;
//     newRow[newKey] = row[key];
//   }
//   return newRow;
// }

// // Apply MMC transformation rules
// function transformInvoiceFields(row) {
//   const transformed = { ...row };

//   // 1. Description mandatory
//   if (!row['Description'] || row['Description'].trim() === '') {
//     transformed['Description'] = '.';
//   }

//   // 2. Status and LineAmountType defaults
//   transformed['Status'] = 'AUTHORISED';
//   transformed['LineAmountTypes'] = 'Exclusive';

//   // 3. Tracking fields logic
//   if (row['TrackingOption1']) {
//     transformed['TrackingName1'] = row['TrackingName1'] || 'Class';
//     transformed['TrackingOption1'] = row['TrackingOption1'];
//   }
//   if (row['TrackingOption2']) {
//     transformed['TrackingName2'] = row['TrackingName2'] || 'Class';
//     transformed['TrackingOption2'] = row['TrackingOption2'];
//   }

//   // 4. Currency and Exchange Rate logic
//   if (row['Currency'] && row['Currency'].trim() !== '') {
//     transformed['Currency'] = row['Currency'];
//     transformed['Exchange rate'] = row['Exchange rate'];
//   }

//   // 5. Type field based on Total
//   const total = parseFloat(row['Total']);
//   if (!isNaN(total)) {
//     transformed['Type'] = total >= 0 ? 'Invoice' : 'Credit Note';
//   } else {
//     transformed['Type'] = '';
//   }

//   // 6. Ensure Quantity is not blank (if blank, set it to 1)
//   if (!row['Quantity'] || row['Quantity'].trim() === '') {
//     transformed['Quantity'] = '1';
//   }

//   return transformed;
// }

// // Final transformation for export
// function transformData(data) {
//   console.log('Data before transformation:', data);  // Log the input data for debugging
//   return data.map(row => {
//     row = renameFields(row);
//     row = transformInvoiceFields(row);

//     const filteredRow = {};
//     allowedColumn.forEach(col => {
//       filteredRow[col] = row[col] || '';
//     });

//     console.log('Transformed row:', filteredRow);  // Log the transformed data
//     return filteredRow;
//   });
// }

// // Upload CSV
// const creditHandler = (req, res) => {
//   uploadedData = [];

//   if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

//   createReadStream(req.file.path)
//     .pipe(csv({
//       mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
//       mapValues: ({ value }) => value ? value.trim() : ''
//     }))
//     .on('data', (row) => {
//       uploadedData.push(row);
//     })
//     .on('end', () => {
//       unlinkSync(req.file.path);
//       console.log('Uploaded Data:', uploadedData);

//       if (uploadedData.length === 0) {
//         return res.status(400).json({ message: 'CSV format error: no valid data found or inconsistent column count.' });
//       }

//       res.json({ message: 'File uploaded and parsed successfully.' });
//     })
//     .on('error', (err) => {
//       unlinkSync(req.file.path);
//       res.status(500).json({ message: `Error while processing the file: ${err.message}` });
//     });
// };

// // Convert and Write CSV
// const creditConvert = (req, res) => {
//   if (!uploadedData || uploadedData.length === 0) {
//     return res.status(400).json({ message: 'No data to convert' });
//   }

//   const transformed = transformData(uploadedData);
//   const csvString = parse(transformed, { fields: allowedColumn });

//   // Log the converted CSV string for debugging
//   console.log('Converted CSV String:', csvString);

//   const outputDir = join(__dirname, 'converted');

//   // Check if the directory exists, and create it if not
//   if (!existsSync(outputDir)) {
//     console.log(`Creating directory: ${outputDir}`);
//     mkdirSync(outputDir);
//   }

//   const outputPath = join(outputDir, 'converted.csv');
//   console.log(`Writing converted file to: ${outputPath}`);

//   // Remove existing file if it exists
//   if (existsSync(outputPath)) {
//     console.log(`Removing existing file: ${outputPath}`);
//     unlinkSync(outputPath);  // Removing old file before writing new data
//   }

//   // Write the new CSV file
//   try {
//     writeFileSync(outputPath, csvString);
//     console.log('File written successfully!');
//     res.json({ message: 'Data converted successfully.' });
//   } catch (err) {
//     console.error('Error writing file:', err);
//     res.status(500).json({ message: 'Error writing converted file.' });
//   }
// };

// // Download CSV
// const creditDownload = (req, res) => {
//   const file = join(__dirname, 'converted', 'converted.csv');
//   console.log(`Checking if file exists: ${file}`);
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

// export {
//   creditHandler,
//   creditConvert,
//   creditDownload
// };

import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import csv from 'csv-parser';
import { parse } from 'json2csv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

let uploadedData = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fieldMapping = {
  'ContactName': 'ContactName',
  'InvoiceNumber': 'InvoiceNumber',
  'Reference': 'Reference',
  'InvoiceDate': 'InvoiceDate',
  'DueDate': 'DueDate',
  'InventoryItemCode': 'InventoryItemCode',
  'Description': 'Description',
  'Quantity': 'Quantity',
  'UnitAmount': 'UnitAmount',
  'Discount': 'Discount',
  'LineAmount': 'LineAmount',
  'AccountCode': 'AccountCode',
  'TaxType': 'TaxType',
  'TaxAmount': 'TaxAmount',
  'TrackingName1': 'TrackingName1',
  'TrackingOption1': 'TrackingOption1',
  'TrackingName2': 'TrackingName2',
  'TrackingOption2': 'TrackingOption2',
  'Currency': 'Currency',
  'Exchange rate': 'Exchange rate',
  'Status': 'Status',
  'Total': 'Total'
};

const allowedColumn = [
  "ContactName", "InvoiceNumber", "Reference", "InvoiceDate", "DueDate", "InventoryItemCode",
  "Description", "Quantity", "UnitAmount", "LineAmount", "AccountCode", "TaxType", "TaxAmount",
  "TrackingName1", "TrackingOption1", "TrackingName2", "TrackingOption2",
  "Currency", "Exchange rate", "LineAmountTypes", "Status", "Total", "Type"
];

function normalizeHeader(header) {
  return header.replace(/\*/g, '').trim();
}

function renameFields(row) {
  const newRow = {};
  for (const key in row) {
    const normalizedKey = normalizeHeader(key);
    const newKey = fieldMapping[normalizedKey] || normalizedKey;
    newRow[newKey] = row[key];
  }
  return newRow;
}

function applyTaxMapping(row) {
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

  let tax = row['TaxType']?.toUpperCase().trim();
  if (tax && taxCodeMap[tax]) {
    row['TaxType'] = taxCodeMap[tax];
  } else {
    row['TaxType'] = 'BAS Excluded';
  }
  return row;
}

function transformInvoiceFields(row) {
  const transformed = { ...row };

  if (!row['Description'] || row['Description'].trim() === '') {
    transformed['Description'] = '.';
  }

  transformed['Status'] = 'AUTHORISED';
  transformed['LineAmountTypes'] = 'Exclusive';

  if (row['TrackingOption1']) {
    transformed['TrackingName1'] = row['TrackingName1'] || 'Class';
    transformed['TrackingOption1'] = row['TrackingOption1'];
  }
  if (row['TrackingOption2']) {
    transformed['TrackingName2'] = row['TrackingName2'] || 'Class';
    transformed['TrackingOption2'] = row['TrackingOption2'];
  }

  if (row['Currency'] && row['Currency'].trim() !== '') {
    transformed['Currency'] = row['Currency'];
    transformed['Exchange rate'] = row['Exchange rate'];
  }

  const total = parseFloat(row['Total']);
  if (!isNaN(total)) {
    transformed['Type'] = total >= 0 ? 'Invoice' : 'Credit Note';
  } else {
    transformed['Type'] = '';
  }

  if (!row['Quantity'] || row['Quantity'].trim() === '') {
    transformed['Quantity'] = '1';
  }

  return transformed;
}

function transformData(data) {
  return data.map(row => {
    row = renameFields(row);
    row = applyTaxMapping(row);
    row = transformInvoiceFields(row);

    const filteredRow = {};
    allowedColumn.forEach(col => {
      filteredRow[col] = row[col] || '';
    });
    return filteredRow;
  });
}

const creditHandler = (req, res) => {
  uploadedData = [];

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  createReadStream(req.file.path)
    .pipe(csv({
      mapHeaders: ({ header }) => normalizeHeader(header.replace(/^\uFEFF/, '')),
      mapValues: ({ value }) => value ? value.trim() : ''
    }))
    .on('data', (row) => {
      uploadedData.push(row);
    })
    .on('end', () => {
      unlinkSync(req.file.path);
      if (uploadedData.length === 0) {
        return res.status(400).json({ message: 'CSV format error: no valid data found or inconsistent column count.' });
      }
      res.json({ message: 'File uploaded and parsed successfully.' });
    })
    .on('error', (err) => {
      unlinkSync(req.file.path);
      res.status(500).json({ message: `Error while processing the file: ${err.message}` });
    });
};

const creditConvert = (req, res) => {
  if (!uploadedData || uploadedData.length === 0) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  const transformed = transformData(uploadedData);
  const csvString = parse(transformed, { fields: allowedColumn });

  const outputDir = join(__dirname, 'converted');
  if (!existsSync(outputDir)) mkdirSync(outputDir);

  const outputPath = join(outputDir, 'converted.csv');
  if (existsSync(outputPath)) unlinkSync(outputPath);

  try {
    writeFileSync(outputPath, csvString);
    res.json({ message: 'Data converted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error writing converted file.' });
  }
};

const creditDownload = (req, res) => {
  const file = join(__dirname, 'converted', 'converted.csv');
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
  creditHandler,
  creditConvert,
  creditDownload
};

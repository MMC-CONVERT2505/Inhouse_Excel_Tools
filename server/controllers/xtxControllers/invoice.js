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

// // Field mapping for consistent column names
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

// // Allowed columns for output
// const allowedColumn = [
//   "ContactName", "InvoiceNumber", "Reference", "InvoiceDate", "DueDate", "InventoryItemCode",
//   "Description", "Quantity", "UnitAmount", "LineAmount", "AccountCode", "TaxType", "TaxAmount",
//   "TrackingName1", "TrackingOption1", "TrackingName2", "TrackingOption2",
//   "Currency", "Exchange rate", "LineAmountTypes", "Status", "Total", "Type"
// ];

// // Function to normalize headers by removing any `*` and trimming extra spaces
// function normalizeHeader(header) {
//   return header.replace(/\*/g, '').trim();  // Remove '*' and trim spaces
// }

// // Rename fields according to mapping
// function renameFields(row) {
//   const newRow = {};
//   for (const key in row) {
//     const trimmedKey = normalizeHeader(key);  // Normalize the header to remove `*`
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
//   return data.map(row => {
//     row = renameFields(row);  // Rename fields according to the mapping
//     row = transformInvoiceFields(row);  // Apply transformation rules

//     const filteredRow = {};
//     allowedColumn.forEach(col => {
//       filteredRow[col] = row[col] || '';  // Ensure empty values are replaced with ''
//     });

//     return filteredRow;
//   });
// }

// // Upload CSV
// const invoiceHandler = (req, res) => {
//   uploadedData = [];

//   if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

//   createReadStream(req.file.path)
//     .pipe(csv({
//       mapHeaders: ({ header }) => normalizeHeader(header),  // Normalize headers by removing `*`
//       mapValues: ({ value }) => value ? value.trim() : ''   // Trim values
//     }))
//     .on('data', (row) => {
//       uploadedData.push(row);
//     })
//     .on('end', () => {
//       unlinkSync(req.file.path);
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
// const invoiceConvert = (req, res) => {
//   if (!uploadedData || uploadedData.length === 0) {
//     return res.status(400).json({ message: 'No data to convert' });
//   }

//   const transformed = transformData(uploadedData);
//   const csvString = parse(transformed, { fields: allowedColumn });

//   const outputDir = join(__dirname, 'converted');

//   if (!existsSync(outputDir)) {
//     mkdirSync(outputDir);
//   }

//   const outputPath = join(outputDir, 'converted.csv');
//   console.log(`Writing converted file to: ${outputPath}`);

//   if (existsSync(outputPath)) {
//     unlinkSync(outputPath);  // Remove old file before writing new data
//   }

//   try {
//     writeFileSync(outputPath, csvString);
//     res.json({ message: 'Data converted successfully.' });
//   } catch (err) {
//     res.status(500).json({ message: 'Error writing converted file.' });
//   }
// };

// // Download CSV
// const invoiceDownload = (req, res) => {
//   const file = join(__dirname, 'converted', 'converted.csv');
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
//   invoiceHandler,
//   invoiceConvert,
//   invoiceDownload
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

// Field Mapping
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

// ✅ Tax Mapping
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
  'GST ON INCOME': 'GST on Income',
  'TAX EXEMPT': 'Tax Exempt'
};

// Normalize headers
function normalizeHeader(header) {
  return header.replace(/\*/g, '').trim();
}

// Rename fields based on mapping
function renameFields(row) {
  const newRow = {};
  for (const key in row) {
    const trimmedKey = normalizeHeader(key);
    const newKey = fieldMapping[trimmedKey] || trimmedKey;
    newRow[newKey] = row[key];
  }
  return newRow;
}

// Tax mapping function
function applyTaxMapping(row) {
  const rawTax = row['TaxType'];
  if (rawTax && typeof rawTax === 'string') {
    const upperTax = rawTax.toUpperCase().trim();
    row['TaxType'] = taxCodeMap[upperTax] || 'BAS Excluded';
  } else {
    row['TaxType'] = 'BAS Excluded';
  }
  return row;
}

// Apply MMC transformation rules
function transformInvoiceFields(row) {
  const transformed = { ...row };

  // Description fallback
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

  if (row['Currency']?.trim()) {
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

// Full transformation pipeline
function transformData(data) {
  return data.map(row => {
    row = renameFields(row);
    row = transformInvoiceFields(row);
    row = applyTaxMapping(row);

    const filteredRow = {};
    allowedColumn.forEach(col => {
      filteredRow[col] = row[col] !== undefined ? row[col] : '';
    });

    return filteredRow;
  });
}

// Upload CSV handler
const invoiceHandler = (req, res) => {
  uploadedData = [];

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  createReadStream(req.file.path)
    .pipe(csv({
      mapHeaders: ({ header }) => normalizeHeader(header),
      mapValues: ({ value }) => value ? value.trim() : ''
    }))
    .on('data', row => uploadedData.push(row))
    .on('end', () => {
      unlinkSync(req.file.path);
      if (!uploadedData.length) {
        return res.status(400).json({ message: 'CSV format error: no valid data found.' });
      }
      res.json({ message: 'File uploaded and parsed successfully.' });
    })
    .on('error', (err) => {
      unlinkSync(req.file.path);
      res.status(500).json({ message: `Error processing file: ${err.message}` });
    });
};

// Convert handler
const invoiceConvert = (req, res) => {
  if (!uploadedData || !uploadedData.length) {
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
    res.status(500).json({ message: 'Error writing file.' });
  }
};

// Download handler
const invoiceDownload = (req, res) => {
  const file = join(__dirname, 'converted', 'converted.csv');
  if (existsSync(file)) {
    res.download(file, err => {
      if (err) res.status(500).json({ message: 'Error downloading the file.' });
    });
  } else {
    res.status(404).json({ message: 'Converted file not found' });
  }
};

export {
  invoiceHandler,
  invoiceConvert,
  invoiceDownload
};

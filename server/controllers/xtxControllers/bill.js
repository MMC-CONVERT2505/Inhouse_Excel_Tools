// import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';
// import csv from 'csv-parser';
// import { parse } from 'json2csv';

// // ✅ Define __dirname manually for ES Modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// let uploadedData = [];

// const fieldMapping = {
//   'ContactName': 'ContactName',
//   'EmailAddress': 'EmailAddress',
//   'POAddressLine1': 'POAddressLine1',
//   'POAddressLine2': 'POAddressLine2',
//   'POAddressLine3': 'POAddressLine3',
//   'POAddressLine4': 'POAddressLine4',
//   'POCity': 'POCity',
//   'PORegion': 'PORegion',
//   'POPostalCode': 'POPostalCode',
//   'POCountry': 'POCountry',
//   'SAAddressLine1': 'SAAddressLine1',
//   'SAAddressLine2': 'SAAddressLine2',
//   'SAAddressLine3': 'SAAddressLine3',
//   'SAAddressLine4': 'SAAddressLine4',
//   'SACity': 'SACity',
//   'SARegion': 'SARegion',
//   'SAPostalCode': 'SAPostalCode',
//   'SACountry': 'SACountry',
//   'InvoiceNumber': 'InvoiceNumber',
//   'Reference': 'Reference',
//   'InvoiceDate': 'InvoiceDate',
//   'DueDate': 'DueDate',
//   'Total': 'Total',
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
//   'Type': 'Type',
//   'Sent': 'Sent',
//   'Status': 'Status',
//   'LineAmountType': 'LineAmountType'
// };

// const allowedColumn = Object.keys(fieldMapping);

// // ✅ Renames fields based on mapping
// function renameFields(row) {
//   const newRow = {};
//   for (const key in row) {
//     const trimmedKey = key.trim();
//     const newKey = fieldMapping[trimmedKey] || trimmedKey;
//     newRow[newKey] = row[key];
//   }
//   return newRow;
// }

// // ✅ Apply MMC rules for Bills
// function transformInvoiceFields(row) {
//   const transformed = { ...row };

//   // Only process Bill rows
//   if (row['Type']?.trim().toLowerCase() !== 'bill') return null;

//   transformed['Description'] = row['Description']?.trim() || '.';
//   transformed['Quantity'] = row['Quantity']?.trim() || '1';
//   transformed['UnitAmount'] = row['UnitAmount'];
//   transformed['AccountCode'] = row['AccountCode'];
//   transformed['TaxType'] = row['TaxType']?.trim() || 'BAS Excluded';

//   if (row['TrackingOption1']) {
//     transformed['TrackingName1'] = row['TrackingName1']?.trim() || 'Class';
//     transformed['TrackingOption1'] = row['TrackingOption1'];
//   }

//   if (row['TrackingOption2']) {
//     transformed['TrackingName2'] = row['TrackingName2']?.trim() || 'Class';
//     transformed['TrackingOption2'] = row['TrackingOption2'];
//   }

//   if (row['Currency']?.trim()) {
//     transformed['Currency'] = row['Currency'];
//   }

//   transformed['Status'] = 'DRAFT';
//   transformed['LineAmountType'] = 'Exclusive';

//   return transformed;
// }

// // ✅ Main transformation pipeline
// function transformData(data) {
//   return data.map(row => {
//     row = renameFields(row);
//     row = transformInvoiceFields(row);
//     if (!row) return null;

//     const result = {};
//     allowedColumn.forEach(col => {
//       result[col] = row[col] || '';
//     });
//     return result;
//   }).filter(Boolean);
// }

// // ✅ Upload CSV
// const billHandler = (req, res) => {
//   uploadedData = [];

//   if (!req.file) {
//     return res.status(400).json({ message: 'No file uploaded' });
//   }

//   const filePath = req.file.path;

//   createReadStream(filePath)
//     .pipe(csv({
//       mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
//       mapValues: ({ value }) => value?.trim() || ''
//     }))
//     .on('data', (row) => uploadedData.push(row))
//     .on('end', () => {
//       if (existsSync(filePath)) unlinkSync(filePath);
//       if (uploadedData.length === 0) {
//         return res.status(400).json({ message: 'CSV is empty or invalid.' });
//       }
//       res.json({ message: 'CSV file uploaded and parsed successfully' });
//     })
//     .on('error', (err) => {
//       if (existsSync(filePath)) unlinkSync(filePath);
//       res.status(500).json({ message: `Failed to read CSV: ${err.message}` });
//     });
// };

// // ✅ Convert
// const billConvert = (req, res) => {
//   if (!uploadedData.length) {
//     return res.status(400).json({ message: 'No uploaded data to convert.' });
//   }

//   const transformed = transformData(uploadedData);

//   if (!transformed.length) {
//     return res.status(400).json({ message: 'No valid "Bill" entries found in uploaded file.' });
//   }

//   const csvString = parse(transformed, { fields: allowedColumn });

//   const outputDir = join(__dirname, '../converted');
//   if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

//   const outputPath = join(outputDir, 'converted.csv');
//   writeFileSync(outputPath, csvString);

//   res.json({ message: 'CSV converted successfully.' });
// };

// // ✅ Download
// const billDownload = (req, res) => {
//   const file = join(__dirname, '../converted/converted.csv');
//   if (existsSync(file)) {
//     res.download(file, 'converted.csv', (err) => {
//       if (err) {
//         res.status(500).json({ message: 'Download error.' });
//       }
//     });
//   } else {
//     res.status(404).json({ message: 'Converted file not found.' });
//   }
// };

// // ✅ Export for routes
// export {
//   billHandler,
//   billConvert,
//   billDownload
// };


// import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';
// import csv from 'csv-parser';
// import { parse } from 'json2csv';

// let uploadedData = [];

// const fieldMapping = {
//   'ContactName': 'ContactName',
//   'EmailAddress': 'EmailAddress',
//   'POAddressLine1': 'POAddressLine1',
//   'POAddressLine2': 'POAddressLine2',
//   'POAddressLine3': 'POAddressLine3',
//   'POAddressLine4': 'POAddressLine4',
//   'POCity': 'POCity',
//   'PORegion': 'PORegion',
//   'POPostalCode': 'POPostalCode',
//   'POCountry': 'POCountry',
//   'SAAddressLine1': 'SAAddressLine1',
//   'SAAddressLine2': 'SAAddressLine2',
//   'SAAddressLine3': 'SAAddressLine3',
//   'SAAddressLine4': 'SAAddressLine4',
//   'SACity': 'SACity',
//   'SARegion': 'SARegion',
//   'SAPostalCode': 'SAPostalCode',
//   'SACountry': 'SACountry',
//   'InvoiceNumber': 'InvoiceNumber',
//   'Reference': 'Reference',
//   'InvoiceDate': 'InvoiceDate',
//   'DueDate': 'DueDate',
//   'Total': 'Total',
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
//   'Type': 'Type',
//   'Sent': 'Sent',
//   'Status': 'Status',
//   'LineAmountType': 'LineAmountType'
// };

// const allowedColumn = Object.keys(fieldMapping);

// // ✅ Renames fields based on mapping
// function renameFields(row) {
//   const newRow = {};
//   for (const key in row) {
//     const trimmedKey = key.trim();
//     const newKey = fieldMapping[trimmedKey] || trimmedKey;
//     newRow[newKey] = row[key];
//   }
//   return newRow;
// }

// // ✅ Apply MMC rules for Bills
// function transformInvoiceFields(row) {
//   const transformed = { ...row };

//   // Only process Bill rows
//   if (row['Type']?.trim().toLowerCase() !== 'bill') return null;

//   transformed['Description'] = row['Description']?.trim() || '.';
//   transformed['Quantity'] = row['Quantity']?.trim() || '1';
//   transformed['UnitAmount'] = row['UnitAmount'];
//   transformed['AccountCode'] = row['AccountCode'];
//   transformed['TaxType'] = row['TaxType']?.trim() || 'BAS Excluded';

//   if (row['TrackingOption1']) {
//     transformed['TrackingName1'] = row['TrackingName1']?.trim() || 'Class';
//     transformed['TrackingOption1'] = row['TrackingOption1'];
//   }

//   if (row['TrackingOption2']) {
//     transformed['TrackingName2'] = row['TrackingName2']?.trim() || 'Class';
//     transformed['TrackingOption2'] = row['TrackingOption2'];
//   }

//   if (row['Currency']?.trim()) {
//     transformed['Currency'] = row['Currency'];
//   }

//   transformed['Status'] = 'DRAFT';
//   transformed['LineAmountType'] = 'Exclusive';

//   return transformed;
// }

// // ✅ Main transformation pipeline
// function transformData(data) {
//   return data.map(row => {
//     row = renameFields(row);
//     row = transformInvoiceFields(row);
//     if (!row) return null;

//     const result = {};
//     allowedColumn.forEach(col => {
//       result[col] = row[col] || '';
//     });
//     return result;
//   }).filter(Boolean);
// }

// // ✅ Upload CSV
// const billHandler = (req, res) => {
//   uploadedData = [];

//   if (!req.file) {
//     return res.status(400).json({ message: 'No file uploaded' });
//   }

//   const filePath = req.file.path;

//   createReadStream(filePath)
//     .pipe(csv({
//       mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
//       mapValues: ({ value }) => value?.trim() || ''
//     }))
//     .on('data', (row) => uploadedData.push(row))
//     .on('end', () => {
//       if (existsSync(filePath)) unlinkSync(filePath);
//       if (uploadedData.length === 0) {
//         return res.status(400).json({ message: 'CSV is empty or invalid.' });
//       }
//       res.json({ message: 'CSV file uploaded and parsed successfully' });
//     })
//     .on('error', (err) => {
//       if (existsSync(filePath)) unlinkSync(filePath);
//       res.status(500).json({ message: `Failed to read CSV: ${err.message}` });
//     });
// };

// // ✅ Convert
// const billConvert = (req, res) => {
//   if (!uploadedData.length) {
//     return res.status(400).json({ message: 'No uploaded data to convert.' });
//   }

//   const transformed = transformData(uploadedData);

//   if (!transformed.length) {
//     return res.status(400).json({ message: 'No valid "Bill" entries found in uploaded file.' });
//   }

//   const csvString = parse(transformed, { fields: allowedColumn });

//   const outputDir = join(__dirname, '../converted');
//   if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

//   const outputPath = join(outputDir, 'converted.csv');
//   writeFileSync(outputPath, csvString);

//   res.json({ message: 'CSV converted successfully.' });
// };

// // ✅ Download
// const billDownload = (req, res) => {
//   const file = join(__dirname, '../converted/converted.csv');
//   if (existsSync(file)) {
//     res.download(file, 'converted.csv', (err) => {
//       if (err) {
//         res.status(500).json({ message: 'Download error.' });
//       }
//     });
//   } else {
//     res.status(404).json({ message: 'Converted file not found.' });
//   }
// };

// // ✅ Export for routes
// export {
//   billHandler,
//   billConvert,
//   billDownload
// };

// import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';
// import csv from 'csv-parser';
// import { parse } from 'json2csv';

// // ✅ Define __dirname manually for ES Modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// let uploadedData = [];

// const fieldMapping = {
//   'ContactName': 'ContactName',
//   'EmailAddress': 'EmailAddress',
//   'POAddressLine1': 'POAddressLine1',
//   'POAddressLine2': 'POAddressLine2',
//   'POAddressLine3': 'POAddressLine3',
//   'POAddressLine4': 'POAddressLine4',
//   'POCity': 'POCity',
//   'PORegion': 'PORegion',
//   'POPostalCode': 'POPostalCode',
//   'POCountry': 'POCountry',
//   'SAAddressLine1': 'SAAddressLine1',
//   'SAAddressLine2': 'SAAddressLine2',
//   'SAAddressLine3': 'SAAddressLine3',
//   'SAAddressLine4': 'SAAddressLine4',
//   'SACity': 'SACity',
//   'SARegion': 'SARegion',
//   'SAPostalCode': 'SAPostalCode',
//   'SACountry': 'SACountry',
//   'InvoiceNumber': 'InvoiceNumber',
//   'Reference': 'Reference',
//   'InvoiceDate': 'InvoiceDate',
//   'DueDate': 'DueDate',
//   'Total': 'Total',
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
//   'Type': 'Type',
//   'Sent': 'Sent',
//   'Status': 'Status',
//   'LineAmountType': 'LineAmountType'
// };

// const allowedColumn = Object.keys(fieldMapping);

// // ✅ Normalize headers by removing '*' and trimming spaces
// function normalizeHeader(header) {
//   return header.replace(/\*/g, '').trim();  // Remove '*' and trim spaces
// }

// // ✅ Renames fields based on mapping
// function renameFields(row) {
//   const newRow = {};
//   for (const key in row) {
//     const trimmedKey = normalizeHeader(key);  // Normalize the header to remove `*`
//     const newKey = fieldMapping[trimmedKey] || trimmedKey;
//     newRow[newKey] = row[key];
//   }
//   return newRow;
// }

// // ✅ Apply MMC rules for Bills
// function transformInvoiceFields(row) {
//   const transformed = { ...row };

//   // Only process Bill rows
//   if (row['Type']?.trim().toLowerCase() !== 'bill') return null;

//   transformed['Description'] = row['Description']?.trim() || '.';
//   transformed['Quantity'] = row['Quantity']?.trim() || '1';
//   transformed['UnitAmount'] = row['UnitAmount'];
//   transformed['AccountCode'] = row['AccountCode'];
//   transformed['TaxType'] = row['TaxType']?.trim() || 'BAS Excluded';

//   if (row['TrackingOption1']) {
//     transformed['TrackingName1'] = row['TrackingName1']?.trim() || 'Class';
//     transformed['TrackingOption1'] = row['TrackingOption1'];
//   }

//   if (row['TrackingOption2']) {
//     transformed['TrackingName2'] = row['TrackingName2']?.trim() || 'Class';
//     transformed['TrackingOption2'] = row['TrackingOption2'];
//   }

//   if (row['Currency']?.trim()) {
//     transformed['Currency'] = row['Currency'];
//   }

//   transformed['Status'] = 'DRAFT';
//   transformed['LineAmountType'] = 'Exclusive';

//   return transformed;
// }

// // ✅ Main transformation pipeline
// function transformData(data) {
//   return data.map(row => {
//     row = renameFields(row);  // Rename fields according to the mapping
//     row = transformInvoiceFields(row);  // Apply transformation rules
//     if (!row) return null;

//     const result = {};
//     allowedColumn.forEach(col => {
//       result[col] = row[col] || '';  // Ensure empty values are replaced with ''
//     });
//     return result;
//   }).filter(Boolean);
// }

// // ✅ Upload CSV
// const billHandler = (req, res) => {
//   uploadedData = [];

//   if (!req.file) {
//     return res.status(400).json({ message: 'No file uploaded' });
//   }

//   const filePath = req.file.path;

//   createReadStream(filePath)
//     .pipe(csv({
//       mapHeaders: ({ header }) => normalizeHeader(header),  // Normalize headers by removing `*`
//       mapValues: ({ value }) => value?.trim() || ''   // Trim values
//     }))
//     .on('data', (row) => uploadedData.push(row))
//     .on('end', () => {
//       if (existsSync(filePath)) unlinkSync(filePath);
//       if (uploadedData.length === 0) {
//         return res.status(400).json({ message: 'CSV is empty or invalid.' });
//       }
//       res.json({ message: 'CSV file uploaded and parsed successfully' });
//     })
//     .on('error', (err) => {
//       if (existsSync(filePath)) unlinkSync(filePath);
//       res.status(500).json({ message: `Failed to read CSV: ${err.message}` });
//     });
// };

// // ✅ Convert
// const billConvert = (req, res) => {
//   if (!uploadedData.length) {
//     return res.status(400).json({ message: 'No uploaded data to convert.' });
//   }

//   const transformed = transformData(uploadedData);

//   if (!transformed.length) {
//     return res.status(400).json({ message: 'No valid "Bill" entries found in uploaded file.' });
//   }

//   const csvString = parse(transformed, { fields: allowedColumn });

//   const outputDir = join(__dirname, '../converted');
//   if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

//   const outputPath = join(outputDir, 'converted.csv');
//   writeFileSync(outputPath, csvString);

//   res.json({ message: 'CSV converted successfully.' });
// };

// // ✅ Download
// const billDownload = (req, res) => {
//   const file = join(__dirname, '../converted/converted.csv');
//   if (existsSync(file)) {
//     res.download(file, 'converted.csv', (err) => {
//       if (err) {
//         res.status(500).json({ message: 'Download error.' });
//       }
//     });
//   } else {
//     res.status(404).json({ message: 'Converted file not found.' });
//   }
// };

// // ✅ Export for routes
// export {
//   billHandler,
//   billConvert,
//   billDownload
// };
import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { parse } from 'json2csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData = [];

// Field mapping
const fieldMapping = {
  'ContactName': 'ContactName',
  'EmailAddress': 'EmailAddress',
  'POAddressLine1': 'POAddressLine1',
  'POAddressLine2': 'POAddressLine2',
  'POAddressLine3': 'POAddressLine3',
  'POAddressLine4': 'POAddressLine4',
  'POCity': 'POCity',
  'PORegion': 'PORegion',
  'POPostalCode': 'POPostalCode',
  'POCountry': 'POCountry',
  'SAAddressLine1': 'SAAddressLine1',
  'SAAddressLine2': 'SAAddressLine2',
  'SAAddressLine3': 'SAAddressLine3',
  'SAAddressLine4': 'SAAddressLine4',
  'SACity': 'SACity',
  'SARegion': 'SARegion',
  'SAPostalCode': 'SAPostalCode',
  'SACountry': 'SACountry',
  'InvoiceNumber': 'InvoiceNumber',
  'Reference': 'Reference',
  'InvoiceDate': 'InvoiceDate',
  'DueDate': 'DueDate',
  'Total': 'Total',
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
  'Type': 'Type',
  'Sent': 'Sent',
  'Status': 'Status',
  'LineAmountType': 'LineAmountType'
};

const allowedColumn = Object.keys(fieldMapping);

// ✅ Tax mapping dictionary
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

// ✅ Normalize header by removing '*' and trimming
function normalizeHeader(header) {
  return header.replace(/\*/g, '').trim();
}

// ✅ Rename fields using fieldMapping
function renameFields(row) {
  const newRow = {};
  for (const key in row) {
    const trimmedKey = normalizeHeader(key);
    const newKey = fieldMapping[trimmedKey] || trimmedKey;
    newRow[newKey] = row[key];
  }
  return newRow;
}

// ✅ Transform and map tax codes
function transformInvoiceFields(row) {
  if (row['Type']?.trim().toLowerCase() !== 'bill') return null;

  const transformed = { ...row };

  transformed['Description'] = row['Description']?.trim() || '.';
  transformed['Quantity'] = row['Quantity']?.trim() || '1';
  transformed['UnitAmount'] = row['UnitAmount'];
  transformed['AccountCode'] = row['AccountCode'];

  // ✅ Tax mapping logic
  const rawTax = row['TaxType']?.trim().toUpperCase();
  transformed['TaxType'] = taxCodeMap[rawTax] || 'BAS Excluded';

  transformed['TaxAmount'] = row['TaxAmount']; // Retain 0 or blank values

  if (row['TrackingOption1']) {
    transformed['TrackingName1'] = row['TrackingName1']?.trim() || 'Class';
    transformed['TrackingOption1'] = row['TrackingOption1'];
  }
  if (row['TrackingOption2']) {
    transformed['TrackingName2'] = row['TrackingName2']?.trim() || 'Class';
    transformed['TrackingOption2'] = row['TrackingOption2'];
  }

  if (row['Currency']?.trim()) {
    transformed['Currency'] = row['Currency'];
  }

  transformed['Status'] = 'DRAFT';
  transformed['LineAmountType'] = 'Exclusive';

  return transformed;
}

// ✅ Final transform function
function transformData(data) {
  return data.map(row => {
    const renamed = renameFields(row);
    const transformed = transformInvoiceFields(renamed);
    if (!transformed) return null;

    const result = {};
    allowedColumn.forEach(col => {
      result[col] = transformed[col] ?? '';
    });
    return result;
  }).filter(Boolean);
}

// ✅ Handler: Upload CSV
const billHandler = (req, res) => {
  uploadedData = [];

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const filePath = req.file.path;

  createReadStream(filePath)
    .pipe(csv({
      mapHeaders: ({ header }) => normalizeHeader(header),
      mapValues: ({ value }) => value?.trim() || ''
    }))
    .on('data', row => uploadedData.push(row))
    .on('end', () => {
      if (existsSync(filePath)) unlinkSync(filePath);
      if (!uploadedData.length) {
        return res.status(400).json({ message: 'CSV is empty or invalid.' });
      }
      res.json({ message: 'CSV file uploaded and parsed successfully' });
    })
    .on('error', err => {
      if (existsSync(filePath)) unlinkSync(filePath);
      res.status(500).json({ message: `Failed to read CSV: ${err.message}` });
    });
};

// ✅ Convert to final CSV
const billConvert = (req, res) => {
  if (!uploadedData.length) {
    return res.status(400).json({ message: 'No uploaded data to convert.' });
  }

  const transformed = transformData(uploadedData);

  if (!transformed.length) {
    return res.status(400).json({ message: 'No valid "Bill" entries found in uploaded file.' });
  }

  const csvString = parse(transformed, { fields: allowedColumn });

  const outputDir = join(__dirname, '../converted');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, 'converted.csv');
  writeFileSync(outputPath, csvString);

  res.json({ message: 'CSV converted successfully.' });
};

// ✅ Download converted CSV
const billDownload = (req, res) => {
  const file = join(__dirname, '../converted/converted.csv');
  if (existsSync(file)) {
    res.download(file, 'converted.csv', err => {
      if (err) res.status(500).json({ message: 'Download error.' });
    });
  } else {
    res.status(404).json({ message: 'Converted file not found.' });
  }
};

export {
  billHandler,
  billConvert,
  billDownload
};

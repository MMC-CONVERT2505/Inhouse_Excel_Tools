// import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';
// import xlsx from 'xlsx';
// import { parse } from 'json2csv';

// // Setup __dirname for ES Module
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// let uploadedData = [];

// // Field mapping
// const fieldMapping = {
//   'Narration': 'Narration',
//   'Date': 'Date',
//   'Description': 'Description',
//   'AccountCode': 'AccountCode',
//   'TaxType': 'TaxRate',
//   'LineAmount': 'Amount',
//   'TrackingName1': 'TrackingName1',
//   'TrackingOption1': 'TrackingOption1',
//   'TrackingName2': 'TrackingName2',
//   'TrackingOption2': 'TrackingOption2',
//   'LineAmountType': 'LineAmountType',
//   'Status': 'Status',
//   'CurrencyRate': 'Currency',
//   'Currency': 'Currency',
// };

// const baseColumns = [
//   'Narration', 'Date', 'Description', 'AccountCode', 'TaxRate', 'Amount',
//   'LineAmountType', 'Status', 'Currency',
// ];

// let optionalTrackingFields = new Set();

// function renameFields(row) {
//   const newRow = {};
//   for (const key in row) {
//     const trimmedKey = key.trim();
//     const newKey = fieldMapping[trimmedKey];
//     if (newKey) {
//       newRow[newKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
//     }
//   }
//   return newRow;
// }

// function transformInvoiceFields(row) {
//   const transformed = { ...row };

//   // Format the date to DD/MM/YYYY
//   if (row['Date']) {
//     const dateObj = new Date(row['Date']);
//     if (!isNaN(dateObj)) {
//       const day = String(dateObj.getDate()).padStart(2, '0');
//       const month = String(dateObj.getMonth() + 1).padStart(2, '0');
//       const year = dateObj.getFullYear();
//       transformed['Date'] = `${day}/${month}/${year}`;
//     } else {
//       transformed['Date'] = row['Date']; // fallback if invalid
//     }
//   }

//   if (!row['Description'] || row['Description'].toString().trim() === '') {
//     transformed['Description'] = '.';
//   }

//   transformed['Status'] = 'POSTED';
//   transformed['LineAmountType'] = 'Exclusive';

//   if (row['TrackingOption1']) {
//     transformed['TrackingName1'] = row['TrackingName1'] || 'Class';
//     transformed['TrackingOption1'] = row['TrackingOption1'];
//   }

//   if (row['TrackingOption2']) {
//     transformed['TrackingName2'] = row['TrackingName2'] || 'Class';
//     transformed['TrackingOption2'] = row['TrackingOption2'];
//   }

//   if (row['Currency'] && row['Currency'].toString().trim() !== '') {
//     transformed['Currency'] = row['Currency'];
//   }

//   return transformed;
// }

// function transformData(data) {
//   const output = data.map(row => {
//     const renamed = renameFields(row);
//     const transformed = transformInvoiceFields(renamed);

//     if (transformed['TrackingName1']) optionalTrackingFields.add('TrackingName1');
//     if (transformed['TrackingOption1']) optionalTrackingFields.add('TrackingOption1');
//     if (transformed['TrackingName2']) optionalTrackingFields.add('TrackingName2');
//     if (transformed['TrackingOption2']) optionalTrackingFields.add('TrackingOption2');

//     return transformed;
//   });

//   return output;
// }

// // Upload Handler
// const manualHandler = (req, res) => {
//   uploadedData = [];
//   optionalTrackingFields = new Set();

//   if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

//   try {
//     const workbook = xlsx.readFile(req.file.path);
//     const sheetName = workbook.SheetNames[0];
//     const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

//     unlinkSync(req.file.path); // delete uploaded file

//     if (sheet.length === 0) {
//       return res.status(400).json({ message: 'Excel file is empty or malformed.' });
//     }

//     uploadedData = sheet.map(row => {
//       const cleanedRow = {};
//       for (let key in row) {
//         const trimmedKey = key.trim();
//         const val = row[key];
//         cleanedRow[trimmedKey] = typeof val === 'string' ? val.trim() : val;
//       }
//       return cleanedRow;
//     });

//     res.json({ message: 'Excel file uploaded and parsed successfully.' });
//   } catch (err) {
//     if (existsSync(req.file.path)) unlinkSync(req.file.path);
//     res.status(500).json({ message: `Error processing Excel file: ${err.message}` });
//   }
// };

// // Convert Handler
// const manualConvert = (req, res) => {
//   if (!uploadedData || uploadedData.length === 0) {
//     return res.status(400).json({ message: 'No data to convert' });
//   }

//   const transformed = transformData(uploadedData);
//   const finalColumns = [...baseColumns, ...Array.from(optionalTrackingFields)];

//   const normalizedRows = transformed.map(row => {
//     const filteredRow = {};
//     finalColumns.forEach(col => {
//       filteredRow[col] = row[col] || '';
//     });
//     return filteredRow;
//   });

//   const csvString = parse(normalizedRows, { fields: finalColumns });

//   const outputDir = join(__dirname, '../converted');
//   if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

//   const outputPath = join(outputDir, 'converted.csv');
//   writeFileSync(outputPath, csvString);

//   res.json({ message: 'Data converted successfully.' });
// };

// // Download Handler
// const manualDownload = (req, res) => {
//   const file = join(__dirname, '../converted/converted.csv');
//   if (existsSync(file)) {
//     res.download(file, err => {
//       if (err) {
//         res.status(500).json({ message: 'Error downloading the file.' });
//       }
//     });
//   } else {
//     res.status(404).json({ message: 'Converted file not found' });
//   }
// };

// export {
//   manualHandler,
//   manualConvert,
//   manualDownload
// };
import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { parse } from 'json2csv';

// Setup __dirname for ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData = [];

// Field mapping
const fieldMapping = {
  'Narration': 'Narration',
  'Date': 'Date',
  'Description': 'Description',
  'AccountCode': 'AccountCode',
  'TaxType': 'TaxRate', // We'll map this further
  'LineAmount': 'Amount',
  'TrackingName1': 'TrackingName1',
  'TrackingOption1': 'TrackingOption1',
  'TrackingName2': 'TrackingName2',
  'TrackingOption2': 'TrackingOption2',
  'LineAmountType': 'LineAmountType',
  'Status': 'Status',
  'CurrencyRate': 'Currency',
  'Currency': 'Currency'
};

const baseColumns = [
  'Narration', 'Date', 'Description', 'AccountCode', 'TaxRate', 'Amount',
  'LineAmountType', 'Status', 'Currency',
];

let optionalTrackingFields = new Set();

// ✅ Tax Code Mapping
const taxCodeMap = {
  'INPUT': 'GST on Expenses',
  'OUTPUT': 'GST on Income',
  'EXEMPTEXPENSES': 'GST Free Expenses',
  'EXEMPTOUTPUT': 'GST Free Income',
  'BAS EXCLUDED': 'BAS Excluded',
  'BASEXCLUDED': 'BAS Excluded',
  'GST FREE EXPENSES': 'GST Free Expenses',
  'GST FREE INCOME': 'GST Free Income',
  'GST ON EXPENSES': 'GST on Expenses',
  'GST ON INCOME': 'GST on Income'
};

function renameFields(row) {
  const newRow = {};
  for (const key in row) {
    const trimmedKey = key.trim();
    const newKey = fieldMapping[trimmedKey];
    if (newKey) {
      newRow[newKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
    }
  }
  return newRow;
}

function transformInvoiceFields(row) {
  const transformed = { ...row };

  // ✅ Tax Mapping Logic
  const taxRaw = row['TaxRate']?.toString().trim().toUpperCase();
  if (taxRaw && taxCodeMap[taxRaw]) {
    transformed['TaxRate'] = taxCodeMap[taxRaw];
  } else {
    transformed['TaxRate'] = 'BAS Excluded'; // default fallback
  }

  // Format the date to DD/MM/YYYY
  if (row['Date']) {
    const dateObj = new Date(row['Date']);
    if (!isNaN(dateObj)) {
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      transformed['Date'] = `${day}/${month}/${year}`;
    } else {
      transformed['Date'] = row['Date']; // fallback if invalid
    }
  }

  if (!row['Description'] || row['Description'].toString().trim() === '') {
    transformed['Description'] = '.';
  }

  transformed['Status'] = 'POSTED';
  transformed['LineAmountType'] = 'Exclusive';

  if (row['TrackingOption1']) {
    transformed['TrackingName1'] = row['TrackingName1'] || 'Class';
    transformed['TrackingOption1'] = row['TrackingOption1'];
  }

  if (row['TrackingOption2']) {
    transformed['TrackingName2'] = row['TrackingName2'] || 'Class';
    transformed['TrackingOption2'] = row['TrackingOption2'];
  }

  if (row['Currency'] && row['Currency'].toString().trim() !== '') {
    transformed['Currency'] = row['Currency'];
  }

  return transformed;
}

function transformData(data) {
  return data.map(row => {
    const renamed = renameFields(row);
    const transformed = transformInvoiceFields(renamed);

    if (transformed['TrackingName1']) optionalTrackingFields.add('TrackingName1');
    if (transformed['TrackingOption1']) optionalTrackingFields.add('TrackingOption1');
    if (transformed['TrackingName2']) optionalTrackingFields.add('TrackingName2');
    if (transformed['TrackingOption2']) optionalTrackingFields.add('TrackingOption2');

    return transformed;
  });
}

// Upload Handler
const manualHandler = (req, res) => {
  uploadedData = [];
  optionalTrackingFields = new Set();

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    unlinkSync(req.file.path); // delete uploaded file

    if (sheet.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or malformed.' });
    }

    uploadedData = sheet.map(row => {
      const cleanedRow = {};
      for (let key in row) {
        const trimmedKey = key.trim();
        const val = row[key];
        cleanedRow[trimmedKey] = typeof val === 'string' ? val.trim() : val;
      }
      return cleanedRow;
    });

    res.json({ message: 'Excel file uploaded and parsed successfully.' });
  } catch (err) {
    if (existsSync(req.file.path)) unlinkSync(req.file.path);
    res.status(500).json({ message: `Error processing Excel file: ${err.message}` });
  }
};

// Convert Handler
const manualConvert = (req, res) => {
  if (!uploadedData || uploadedData.length === 0) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  const transformed = transformData(uploadedData);
  const finalColumns = [...baseColumns, ...Array.from(optionalTrackingFields)];

  const normalizedRows = transformed.map(row => {
    const filteredRow = {};
    finalColumns.forEach(col => {
      filteredRow[col] = row[col] || '';
    });
    return filteredRow;
  });

  const csvString = parse(normalizedRows, { fields: finalColumns });

  const outputDir = join(__dirname, '../converted');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, 'converted.csv');
  writeFileSync(outputPath, csvString);

  res.json({ message: 'Data converted successfully.' });
};

// Download Handler
const manualDownload = (req, res) => {
  const file = join(__dirname, '../converted/converted.csv');
  if (existsSync(file)) {
    res.download(file, err => {
      if (err) {
        res.status(500).json({ message: 'Error downloading the file.' });
      }
    });
  } else {
    res.status(404).json({ message: 'Converted file not found' });
  }
};

export {
  manualHandler,
  manualConvert,
  manualDownload
};

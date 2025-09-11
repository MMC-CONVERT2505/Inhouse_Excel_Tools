// import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';
// import csv from 'csv-parser';
// import { parse } from 'json2csv';

// // Define __dirname in ES Modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// let uploadedData = [];

// const allowedColumns = [
//   "ContactName", "AccountNumber", "EmailAddress", "FirstName", "LastName", "POAttentionTo", "PhoPOAddressLine1", "POAddressLine2",
//   "POAddressLine3", "POAddressLine4", "POCity", "PORegion", "POPostalCode", "POCountry", "SAAttentionTo", "SAAddressLine1",
//   "SAAddressLine2", "SAAddressLine3", "SAAddressLine4", "SACity", "SARegion", "SAPostalCode", "SACountry", "PhoneNumber", "FaxNumber", 
//   "MobileNumber", "DDINumber", "SkypeName", "BankAccountName", "BankAccountNumber", "BankAccountParticulars", "TaxNumber", 
//   "AccountsReceivableTaxCodeName", "AccountsPayableTaxCodeName", "Website", "LegalName", "Discount", "CompanyNumber",
// ];

// // Handler for file upload and parsing
// const contactHandler = (req, res) => {
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

// // Handler for transformation + save to disk
// const contactConvert = (req, res) => {
//   if (uploadedData.length === 0) {
//     return res.status(400).json({ message: 'No data to convert' });
//   }

//   try {
//     const dynamicColumns = allowedColumns.filter(col =>
//       uploadedData.some(row => row[col] && row[col].toString().trim() !== '')
//     );

//     const transformed = transformData(uploadedData, dynamicColumns);
//     const csvString = parse(transformed, { fields: dynamicColumns });

//     const outputDir = join(__dirname, 'converted');  // Use absolute path for the output folder
//     if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

//     const outputPath = join(outputDir, 'converted.csv');
//     console.log('Saving converted file to:', outputPath);  // Log the full path to check if it's correct
//     writeFileSync(outputPath, csvString);

//     res.json({ message: 'Data converted successfully.' });
//   } catch (err) {
//     res.status(500).json({ message: `Error during conversion: ${err.message}` });
//   }
// };

// // Handler for downloading the generated CSV
// const contactDownload = (req, res) => {
//   const file = join(__dirname, 'converted', 'converted.csv');  // Ensure this path is correct
//   console.log('Attempting to download file at:', file);  // Debugging: Log the file path

//   if (existsSync(file)) {
//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader('Content-Disposition', 'attachment; filename="converted.csv"');
//     res.download(file, 'converted.csv', (err) => {
//       if (err) {
//         console.error('Error downloading the file:', err);  // Log the error for debugging
//         res.status(500).json({ message: 'Error downloading the file.' });
//       }
//     });
//   } else {
//     console.error('Converted file not found at:', file);  // Log to confirm the file exists
//     res.status(404).json({ message: 'Converted file not found' });
//   }
// };

// // Transformation logic
// const transformData = (data, columnsToInclude) => {
//   return data.map(row => {
//     const transformed = {};
//     columnsToInclude.forEach(col => {
//       transformed[col] = row[col] || '';
//     });
//     return transformed;
//   });
// };

// export { contactHandler, contactConvert, contactDownload };
import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { parse } from 'json2csv';

// Define __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData = [];

// List of allowed columns
const allowedColumns = [
  "ContactName", "AccountNumber", "EmailAddress", "FirstName", "LastName", "POAttentionTo", "PhoPOAddressLine1", "POAddressLine2",
  "POAddressLine3", "POAddressLine4", "POCity", "PORegion", "POPostalCode", "POCountry", "SAAttentionTo", "SAAddressLine1",
  "SAAddressLine2", "SAAddressLine3", "SAAddressLine4", "SACity", "SARegion", "SAPostalCode", "SACountry", "PhoneNumber", "FaxNumber", 
  "MobileNumber", "DDINumber", "SkypeName", "BankAccountName", "BankAccountNumber", "BankAccountParticulars", "TaxNumber", 
  "AccountsReceivableTaxCodeName", "AccountsPayableTaxCodeName", "Website", "LegalName", "Discount", "CompanyNumber",
];

// Normalize headers: remove *, trim, lowercase
const normalizeHeader = (header) => header.replace(/\*/g, '').trim();

// Handler for file upload and parsing
const contactHandler = (req, res) => {
  uploadedData = [];
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  createReadStream(req.file.path)
    .pipe(csv({
      mapHeaders: ({ header }) => normalizeHeader(header),
      mapValues: ({ value }) => value ? value.trim() : '' // Trimming empty values
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

// Handler for transformation + save to disk
const contactConvert = (req, res) => {
  if (uploadedData.length === 0) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  try {
    // Dynamically check for columns present in the data
    const dynamicColumns = allowedColumns.filter(col =>
      uploadedData.some(row => row[col] && row[col].toString().trim() !== '')
    );

    // Apply the transformation
    const transformed = transformData(uploadedData, dynamicColumns);
    const csvString = parse(transformed, { fields: dynamicColumns });

    // Output directory for saving the converted file
    const outputDir = join(__dirname, 'converted');
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    const outputPath = join(outputDir, 'converted.csv');
    console.log('Saving converted file to:', outputPath);  // Log for checking

    writeFileSync(outputPath, csvString);

    res.json({ message: 'Data converted successfully.' });
  } catch (err) {
    res.status(500).json({ message: `Error during conversion: ${err.message}` });
  }
};

// Handler for downloading the generated CSV
const contactDownload = (req, res) => {
  const file = join(__dirname, 'converted', 'converted.csv');
  console.log('Attempting to download file at:', file);  // Debugging: Log file path

  if (existsSync(file)) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="converted.csv"');
    res.download(file, 'converted.csv', (err) => {
      if (err) {
        console.error('Error downloading the file:', err);  // Log download error
        res.status(500).json({ message: 'Error downloading the file.' });
      }
    });
  } else {
    console.error('Converted file not found at:', file);  // Log file path not found
    res.status(404).json({ message: 'Converted file not found' });
  }
};

// Transformation logic: include only allowed columns in the final output
const transformData = (data, columnsToInclude) => {
  return data.map(row => {
    const transformed = {};
    columnsToInclude.forEach(col => {
      transformed[col] = row[col] || '';  // Default to empty string if the column doesn't exist in a row
    });
    return transformed;
  });
};

export { contactHandler, contactConvert, contactDownload };

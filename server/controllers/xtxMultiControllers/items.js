import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { parse } from 'json2csv';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData = [];

// Allowed columns list
const allowedColumns = [
  "ItemCode", "ItemName", "PurchasesDescription", "PurchasesUnitPrice", "PurchasesAccount", "PurchasesTaxRate",
  "SalesDescription", "SalesUnitPrice", "SalesAccount", "SalesTaxRate", "InventoryAssetAccount", "CostOfGoodsSoldAccount",
];

const permanentColumns = [
  "ItemCode", "ItemName", "SalesAccount",
];

// Function to normalize header names (remove * and trim spaces)
const normalizeHeader = (header) => {
  return header.replace(/\*/g, '').trim();  // Removes '*' and trims spaces
};

// Handler for file upload and parsing
const itemsHandlerMulti = (req, res) => {
  uploadedData = [];
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  createReadStream(req.file.path)
    .pipe(csv({
      mapHeaders: ({ header }) => normalizeHeader(header),  // Normalize the header names
      mapValues: ({ value }) => value ? value.trim() : ''   // Trim any extra spaces in values
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
const itemsConvertMulti = (req, res) => {
  if (uploadedData.length === 0) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  try {
    // Dynamically check for columns present in the data
    const dynamicColumns = allowedColumns.filter(col =>
      !permanentColumns.includes(col) &&
      uploadedData.some(row => row[col] && row[col].toString().trim() !== '')
    );

    const finalColumns = Array.from(new Set([...permanentColumns, ...dynamicColumns]));

    const transformed = transformData(uploadedData, finalColumns);

    const csvString = parse(transformed, { fields: finalColumns });

    const outputDir = join(__dirname, 'converted');  // Use absolute path for the output folder
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    const outputPath = join(outputDir, 'converted.csv');
    console.log('Saving file to:', outputPath);  // Log the full path to check if it's correct
    writeFileSync(outputPath, csvString);

    res.json({ message: 'Data converted successfully.' });
  } catch (err) {
    res.status(500).json({ message: `Error during conversion: ${err.message}` });
  }
};

// Handler for downloading the generated CSV
const itemsDownloadMulti = (req, res) => {
  const file = join(__dirname, 'converted', 'converted.csv');  // Ensure this path is correct
  console.log('Attempting to download file at:', file);  // Log file path for debugging

  if (existsSync(file)) {
    res.download(file, (err) => {
      if (err) {
        console.error('Error downloading the file:', err);  // Log the error for debugging
        res.status(500).json({ message: 'Error downloading the file.' });
      }
    });
  } else {
    console.error('File not found at:', file);  // Log file not found
    res.status(404).json({ message: 'Converted file not found' });
  }
};

// Transformation logic: include only allowed columns in the final output
const transformData = (data, columns) => {
  return data.map(row => {
    const transformed = {};
    columns.forEach(col => {
      transformed[col] = row[col] || '';  // Default to empty string if the column doesn't exist in a row
    });
    return transformed;
  });
};

export { itemsHandlerMulti, itemsConvertMulti, itemsDownloadMulti };

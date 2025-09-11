import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { parse } from 'json2csv';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData = [];

const allowedColumns = [
  "Tracking Category Name", "Category Option"
];

const permanentColumns = [
  "Tracking Category Name", "Category Option"
];

const classHandler = (req, res) => {
  uploadedData = [];
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  createReadStream(req.file.path)
    .pipe(csv({
      mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
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

const classConvert = (req, res) => {
  if (uploadedData.length === 0) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  try {
    const dynamicColumns = allowedColumns.filter(col =>
      !permanentColumns.includes(col) &&
      uploadedData.some(row => row[col] && row[col].toString().trim() !== '')
    );

    const finalColumns = Array.from(new Set([...permanentColumns, ...dynamicColumns]));

    const transformed = transformData(uploadedData, finalColumns);

    const csvString = parse(transformed, { fields: finalColumns });

    const outputDir = join(__dirname, 'converted');  // Use absolute path for the output folder
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });  // Ensure folder is created

    const outputPath = join(outputDir, 'converted.csv');
    console.log('File created at:', outputPath);  // Log the file creation for debugging
    writeFileSync(outputPath, csvString);

    res.json({ message: 'Data converted successfully.' });
  } catch (err) {
    res.status(500).json({ message: `Error during conversion: ${err.message}` });
  }
};

const classDownload = (req, res) => {
  const file = join(__dirname, 'converted', 'converted.csv');  // Absolute path to the file
  console.log('Attempting to download file from:', file);  // Log file path for debugging

  if (existsSync(file)) {
    res.download(file, (err) => {
      if (err) {
        console.error('Error downloading the file:', err);  // Log the error for debugging
        res.status(500).json({ message: 'Error downloading the file.' });
      }
    });
  } else {
    console.error('Converted file not found at:', file);  // Log file not found
    res.status(404).json({ message: 'Converted file not found' });
  }
};

const transformData = (data, columns) => {
  return data.map(row => {
    const transformed = {};
    columns.forEach(col => {
      transformed[col] = row[col] || '';
    });
    return transformed;
  });
};

export { classHandler, classConvert, classDownload };

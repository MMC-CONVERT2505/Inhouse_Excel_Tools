import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import csv from 'csv-parser';
import { parse } from 'json2csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainData = [];
let referenceData = [];

// Normalize the header: remove BOM, *, spaces, and lowercase
const normalizeHeader = (header) =>
  header.replace(/^﻿/, '').replace(/\*/g, '').trim().toLowerCase();

// CSV reading function
const readCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(
        csv({
          mapHeaders: ({ header }) => normalizeHeader(header),
          mapValues: ({ value }) => (value ? value.trim() : ''),
        })
      )
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
};

const conversionbalanceHandlerMulti = (req, res) => {
  mainData = [];
  referenceData = [];

  const files = req.files;
  if (!files || !files.file || !files.file2) {
    return res.status(400).json({ message: 'Both files are required' });
  }

  const file1Path = files.file[0].path;
  const file2Path = files.file2[0].path;

  Promise.all([readCSV(file1Path), readCSV(file2Path)])
    .then(([data1, data2]) => {
      unlinkSync(file1Path);
      unlinkSync(file2Path);

      if (data1.length === 0 || data2.length === 0) {
        return res
          .status(400)
          .json({ message: 'One or both CSV files are empty or invalid' });
      }

      mainData = data1;
      referenceData = data2;

      res.json({ message: 'Files uploaded and parsed successfully' });
    })
    .catch((err) => {
      unlinkSync(file1Path);
      unlinkSync(file2Path);
      res
        .status(500)
        .json({ message: `Error while processing files: ${err.message}` });
    });
};

const conversionbalanceConvertMulti = (req, res) => {
  if (!mainData.length || !referenceData.length) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  try {
    // Build reference map
    const referenceMap = {};
    referenceData.forEach((row) => {
      const accCode = row['account code']?.trim();
      const debit = row['debit - year to date']?.trim();
      const credit = row['credit - year to date']?.trim();
      if (accCode) {
        referenceMap[accCode] = { debit, credit };
      }
    });

    // Get the column keys from mainData (normalized headers)
    const headerKeys = Object.keys(mainData[0]);
    const codeKey = headerKeys.find((h) => h === 'code');
    const balanceKey = headerKeys.find((h) => h === 'balance');
    const typeKey = headerKeys.find((h) => h === 'type');
    const dashboardKey = headerKeys.find((h) => h === 'dashboard');

    if (!codeKey || !balanceKey || !typeKey) {
      return res.status(400).json({
        message: 'Required columns (Code, Balance, or Type) not found in Sheet 1',
      });
    }

    const transformed = mainData.map((row) => {
      const code = row[codeKey]?.trim();
      const match = referenceMap[code];

      if (match) {
        if (match.credit && match.credit !== '0') {
          row[balanceKey] = `-${match.credit}`;
        } else if (match.debit && match.debit !== '0') {
          row[balanceKey] = match.debit;
        } else {
          row[balanceKey] = '';
        }
      }

      const typeValue = row[typeKey]?.toLowerCase();
      const dashboardValue = typeValue === 'bank' ? 'Yes' : 'No';

      if (dashboardKey) {
        row[dashboardKey] = dashboardValue;
      } else {
        row['dashboard'] = dashboardValue;
      }

      return row;
    });

    // Capitalize each field for output
    const finalFields = Object.keys(transformed[0]).map(
      (field) => field.charAt(0).toUpperCase() + field.slice(1)
    );

    const normalizedTransformed = transformed.map((row) => {
      const newRow = {};
      for (const key in row) {
        const newKey = key.charAt(0).toUpperCase() + key.slice(1);
        newRow[newKey] = row[key];
      }
      return newRow;
    });

    const csvString = parse(normalizedTransformed, { fields: finalFields });

    const outputDir = join(__dirname, '../converted');
    if (!existsSync(outputDir)) mkdirSync(outputDir);

    const outputPath = join(outputDir, 'converted.csv');
    writeFileSync(outputPath, csvString);

    res.json({
      message: 'Data converted successfully',
      file: '/converted/converted.csv',
    });
  } catch (err) {
    console.error('Error during conversion:', err);
    res.status(500).json({ message: `Conversion error: ${err.message}` });
  }
};

const conversionbalanceDownloadMulti = (req, res) => {
  const file = join(__dirname, '../converted/converted.csv');
  if (existsSync(file)) {
    res.download(file, (err) => {
      if (err) {
        console.error('Error downloading the file:', err);
        res.status(500).json({ message: 'Error downloading the file.' });
      }
    });
  } else {
    res.status(404).json({ message: 'Converted file not found' });
  }
};

export {
  conversionbalanceHandlerMulti,
  conversionbalanceConvertMulti,
  conversionbalanceDownloadMulti,
};

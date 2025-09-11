import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

const paychequeMapping = {
  'Date': 'Date',
  'Source Name': 'Contact Name',
  'Num': 'Reference',
  'Description': 'Description',
  'Account': 'Item Account Code',
  'Tax Code': 'Tax Rate',
  'Tax Amount': 'Tax Amount',
  'Class': 'Tracking Option 1',
  'line Amount Types': 'Line Amount Types',
  'Trans #': 'Trans #',
  'Debit': 'Debit',
  'Credit': 'Credit',
  'Bank Account Code': 'Bank Account Code'
};

const allowedPaychequeColumns = [
  'Date', 'Contact Name', 'Reference', 'Description', 'Item Account Code',
  'Bank Account Code', 'Line Amount', 'Tax Rate', 'Tax Amount', 'Line Amount Types',
  'Tracking Name 1','Tracking Option 1', 'Tracking Name 2', 
  'Tracking Option 2', 'Currency Code', 'Exchange Rate', 'Trans #'
];

let uploadedPaychequePath = '';

const uploadPaycheque = (req, res) => {
  uploadedPaychequePath = req.file.path;
  res.json({ message: 'Paycheque file uploaded successfully.' });
};

const cleanNumber = (val) => {
  if (typeof val === 'string') return parseFloat(val.replace(/,/g, '').trim()) || 0;
  return parseFloat(val) || 0;
};

const convertPaycheque = async (req, res) => {
    try {
      if (!existsSync(uploadedPaychequePath)) {
        return res.status(400).json({ error: 'Paycheque file not found.' });
      }

  
      const rows = await parseCSV(uploadedPaychequePath);  
      const bankAccountCodeLookup = {};
      const finalRows = [];
  
      // Step 1: Separate bank rows
      const bankRows = rows.filter(row => {
        const accType = (row['Account Type'] || '').toLowerCase();
        const cr = cleanNumber(row['Credit']);
        return accType.includes('bank') && cr > 0;
      });
  
  
      // Step 2: Create VLOOKUP map from bankRows
      bankRows.forEach(row => {
        const transNo = row['Trans #'];
        const accountCode = (row['Account'] || '').split(' ')[0];
        if (transNo) bankAccountCodeLookup[transNo] = accountCode;
      });

  
      // Step 3: Filter main rows (non-bank)
      const filteredMainRows = rows.filter(row => {
        const accType = (row['Account Type'] || '').toLowerCase();
        const cr = cleanNumber(row['Credit']);
        return !(accType.includes('bank') && cr > 0);
      });
  
      // Step 4: Map rows to Paycheque format
      filteredMainRows.forEach(row => {
        const transNo = row['Trans #'];
        const dr = cleanNumber(row['Debit']);
        const cr = cleanNumber(row['Credit']);
  
        const mappedRow = {};
        mappedRow['Line Amount'] = (dr - cr).toFixed(2);
  
        Object.entries(paychequeMapping).forEach(([src, dest]) => {
          let value = row[src] || '';
  
          if (dest === 'Item Account Code') value = value.split(' ')[0];
          if (dest === 'Bank Account Code') value = bankAccountCodeLookup[transNo] || '';
  
          mappedRow[dest] = value;
        });
  
             // Contact Name fallback
             if (!mappedRow['Contact Name'] || mappedRow['Contact Name'].trim() === '') {
                mappedRow['Contact Name'] = 'No Name';
              }
      
              // Apply fixed rules
              mappedRow['Line Amount Types'] = 'Exclusive';           // Always exclusive
              mappedRow['Tax Rate'] = 'BAS Excluded';                 // Always BAS Excluded
      
              // Set Tracking Name 1 if Tracking Option 1 has value
              if (mappedRow['Tracking Option 1'] && mappedRow['Tracking Option 1'].trim() !== '') {
                mappedRow['Tracking Name 1'] = 'Class';
              }
      
  
        // Ensure all expected columns are filled
        allowedPaychequeColumns.forEach(col => {
          if (!(col in mappedRow)) mappedRow[col] = '';
        });
  
        if (parseFloat(mappedRow['Line Amount']) !== 0) {
            finalRows.push(mappedRow);
          }
      });
  
      const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
      mkdirSync(outputDir, { recursive: true });
  
      const outputFile = 'converted_paycheque.csv';
      const filePath = join(outputDir, outputFile);
      writeFileSync(filePath, new Parser({ fields: allowedPaychequeColumns }).parse(finalRows));
  

  
      return res.json({
        message: 'Paycheque file converted successfully.',
       downloadLink: `/download-paycheque/${outputFile}`
      });
  
    } catch (err) {
      console.error('💥 Paycheque Conversion Error:', err);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
  

  
const downloadPaycheque = (req, res) => {
    const fileName = req.params.filename;
    const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);
  
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
  
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
  };

const parseCSV = (filePath) => new Promise((resolve, reject) => {
  const results = [];
  createReadStream(filePath)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', () => resolve(results))
    .on('error', reject);
});

export  { uploadPaycheque, convertPaycheque ,downloadPaycheque};

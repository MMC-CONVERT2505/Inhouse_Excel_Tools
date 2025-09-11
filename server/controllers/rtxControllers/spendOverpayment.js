import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

// Spend Overpayment mapping according to image and simple naming
const spendOverpaymentMapping = {
    'Date': 'Date',
    'Name': 'Contact Name',
    'Num': 'Reference',
    'Split': 'Bank Account Code',
    'Quantity': 'Quantity',
    'unitAmount': 'Unit Amount',
    'Open Balance': 'Line Amount',
    'Tax Code': 'Tax Rate',
    'Trans #': 'Trans #'
};

const allowedSpendOverpaymentColumns = [
    'Date','Contact Name','Reference',
    'Description','Item Code', 'Item Account Code',
    'Bank Account Code', 'Quantity','unitAmount','lineAmount',
    'Tax Rate','Tax Amount','line Amount Types','Tracking Name 1','Tracking Option 1',
    'Tracking Name 2','Tracking Option 2',
    'Currency Code','Exchange Rate','Trans #'
];


let uploadedSpendOverpaymentPath = '';

// Upload function for Spend Overpayment CSV
const uploadSpendOverpayment = (req, res) => {
    uploadedSpendOverpaymentPath = req.file.path;
    res.json({ message: 'Spend Overpayment file uploaded successfully.' });
};

// Utility: parse CSV file
const parseCSV = (filePath) => new Promise((resolve, reject) => {
    const results = [];
    createReadStream(filePath)
        .pipe(csvParser())
        .on('data', data => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
});

// Conversion function for Spend Overpayment
const convertSpendOverpayment = async (req, res) => {
    try {
      if (!existsSync(uploadedSpendOverpaymentPath)) {
        return res.status(400).json({ error: 'Spend Overpayment file not found.' });
      }
  
      const rows = await parseCSV(uploadedSpendOverpaymentPath);
  
      // Filter rows where Type is "Bill Pmt -Cheque" or "Bill Pmt -CCard"
      const filteredRows = rows.filter(row => {
        const type = (row['Type'] || '').toLowerCase();
        return type === 'bill pmt -cheque' || type === 'bill pmt -ccard';
      });
  
      // Map filtered rows to template with spendOverpaymentMapping and apply fixed rules
      const mappedRows = filteredRows.map(row => {
        const mappedRow = {};
    
        // Map fields using spendOverpaymentMapping (inputKey -> outputKey)
        Object.entries(spendOverpaymentMapping).forEach(([inputKey, outputKey]) => {
            if (outputKey === 'Bank Account Code') {
                const val = row[inputKey] || '';

    
                // Try splitting by space first (instead of " ·")
                const cleaned = val.split(' ')[0].trim();
                mappedRow[outputKey] = cleaned;
            } else if (outputKey === 'Reference') {
                // Reference should come from 'Num' field
                mappedRow[outputKey] = row[inputKey] || '';
            } else {
                mappedRow[outputKey] = row[inputKey] || '';
            }
        });
    
        // Amount: convert to positive number and format to 2 decimals (using 'Open Balance' field)
        let amountNum = parseFloat((row['Open Balance'] || '0').toString().replace(/,/g, '').trim()) || 0;
        if (amountNum < 0) amountNum = Math.abs(amountNum);
        mappedRow['lineAmount'] = amountNum.toFixed(2);
    
        // Account Code always '800'
        mappedRow['Item Account Code'] = '800';
    
        // Description always '.'
        mappedRow['Description'] = '.';
    
        // Add fixed columns for Tax Rate and line Amount Types
        mappedRow['Tax Rate'] = 'BAS Excluded';
        mappedRow['line Amount Types'] = 'NoTax';
    
        // Fill other allowed columns if missing (empty string)
        allowedSpendOverpaymentColumns.forEach(col => {
            if (!(col in mappedRow)) mappedRow[col] = '';
        });
    
        return mappedRow;
    });
    
  
      // Create output directory if not exists
      const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
      mkdirSync(outputDir, { recursive: true });
  
      // Write CSV file
      const csv = new Parser({ fields: allowedSpendOverpaymentColumns }).parse(mappedRows);
      const outputFilePath = join(outputDir, 'converted_spend_overpayment.csv');
      writeFileSync(outputFilePath, csv);
  
      return res.json({
        message: 'Spend Overpayment file converted successfully.',
        downloadLink: '/download-spend-overpayment/converted_spend_overpayment.csv',
        fileName
      });
  
    } catch (error) {
      console.error('Error converting Spend Overpayment:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
  

// Download function
const downloadSpendOverpayment = (req, res) => {
    const fileName = req.params.filename;
    const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);
    if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath, fileName, err => {
        if (err) {
            console.error('Download error:', err);
            res.status(500).json({ error: 'Download failed' });
        }
    });
};

export  { uploadSpendOverpayment, convertSpendOverpayment, downloadSpendOverpayment };


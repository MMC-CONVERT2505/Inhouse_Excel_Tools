import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

const liabilityChequeMapping = {
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

const allowedLiabilityChequeColumns = [
  'Date', 'Contact Name', 'Reference', 'Description', 'Item Account Code',
  'Bank Account Code', 'Line Amount', 'Tax Rate', 'Tax Amount', 'Line Amount Types',
  'Tracking Name 1','Tracking Option 1', 'Tracking Name 2',
  'Tracking Option 2', 'Currency Code', 'Exchange Rate', 'Trans #'
];

let uploadedLiabilityChequePath = '';

const uploadLiabilityCheque = (req, res) => {
  uploadedLiabilityChequePath = req.file.path;
  
  res.json({ message: 'Liability Cheque file uploaded successfully.' });
};

const cleanNumber = (val) => {
  if (typeof val === 'string') return parseFloat(val.replace(/,/g, '').trim()) || 0;
  return parseFloat(val) || 0;
};

const convertLiabilityCheque = async (req, res) => {
  try {
    if (!existsSync(uploadedLiabilityChequePath)) {
      return res.status(400).json({ error: 'Liability Cheque file not found.' });
    }

    const rows = await parseCSV(uploadedLiabilityChequePath);
    const bankAccountCodeLookup = {};
    const finalRows = [];

    const bankRows = rows.filter(row => {
      const accType = (row['Account Type'] || '').toLowerCase();
      const cr = cleanNumber(row['Credit']);
      return accType.includes('bank') && cr > 0;
    });

    bankRows.forEach(row => {
      const transNo = row['Trans #'];
      const accountCode = (row['Account'] || '').split(' ')[0];
      if (transNo) bankAccountCodeLookup[transNo] = accountCode;
    });

    const filteredMainRows = rows.filter(row => {
      const accType = (row['Account Type'] || '').toLowerCase();
      const cr = cleanNumber(row['Credit']);
      return !(accType.includes('bank') && cr > 0);
    });

    filteredMainRows.forEach(row => {
      const transNo = row['Trans #'];
      const dr = cleanNumber(row['Debit']);
      const cr = cleanNumber(row['Credit']);

      const mappedRow = {};
      mappedRow['Line Amount'] = (dr - cr).toFixed(2);

      Object.entries(liabilityChequeMapping).forEach(([src, dest]) => {  
        let value = row[src] || '';
        if (dest === 'Item Account Code') value = value.split(' ')[0];
        if (dest === 'Bank Account Code') value = bankAccountCodeLookup[transNo] || '';
        mappedRow[dest] = value;
      });

      if (!mappedRow['Contact Name'] || mappedRow['Contact Name'].trim() === '') {
        mappedRow['Contact Name'] = 'No Name';
      }

      mappedRow['Line Amount Types'] = 'Exclusive';
      mappedRow['Tax Rate'] = 'BAS Excluded';

      if (mappedRow['Tracking Option 1'] && mappedRow['Tracking Option 1'].trim() !== '') {
        mappedRow['Tracking Name 1'] = 'Class';
      }

      allowedLiabilityChequeColumns.forEach(col => {
        if (!(col in mappedRow)) mappedRow[col] = '';
      });

      if (parseFloat(mappedRow['Line Amount']) !== 0) {
        finalRows.push(mappedRow);
      }
    });

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
    mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_liability_cheque.csv';
    const filePath = join(outputDir, fileName);
    writeFileSync(filePath, new Parser({ fields: allowedLiabilityChequeColumns }).parse(finalRows));

    return res.json({
      message: 'Liability Cheque file converted successfully.',
      downloadLink: `/download-liability-cheque/${fileName}`,
      fileName
    });

  } catch (err) {
    console.error('💥 Liability Cheque Conversion Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

const downloadLiabilityCheque = (req, res) => {
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

export  { uploadLiabilityCheque, convertLiabilityCheque, downloadLiabilityCheque };

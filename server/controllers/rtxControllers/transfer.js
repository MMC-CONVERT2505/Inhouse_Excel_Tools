import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';
import archiver from 'archiver';
// const archiver = require('archiver');

const allowedBankTransferColumns = [
  'Bank Transfer Date', 'Amount', 'Reference',
  'From Bank Account Name', 'To Bank Account Name',
  'Exchange Rate', 'Trans #'
];

const allowedTransferSpendColumns = [
  'Date', 'Contact Name', 'Reference', 'Description', 'item Account Code',
  'Bank Account Code', 'Line Amount', 'Tax Rate', 'Tax Amount', 'line Amount Types',
  'Tracking Name 1', 'Tracking Option 1', 'Tracking Name 2', 'Tracking Option 2',
  'Currency Code', 'Exchange Rate', 'Trans #'
];

const arMapping = {
  'Name': '*ContactName',
  'Num': '*InvoiceNumber',
  'Trans #': 'Reference',
  'Date': '*InvoiceDate',
  'Date': '*DueDate',
  'Description': '*Description',
  'Account': '*AccountCode',
  'Class': 'TrackingOption1'
};

const allowedArColumns = [
  '*ContactName', 'EmailAddress',
  'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4',
  'POCity', 'PORegion', 'POPostalCode', 'POCountry',
  '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate', 'Total',
  'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount',
  'Discount', '*AccountCode', '*TaxType', 'TaxAmount',
  'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2',
  'Currency', 'BrandingTheme'
];

const apMapping = {
  'Name': '*ContactName',
  'Num': '*InvoiceNumber',
  'Trans #': 'Trans #',
  'Date': '*InvoiceDate',
  'Date': '*DueDate',
  'Description': '*Description',
  'Account': '*AccountCode',
  'Class': 'TrackingOption1'
};

const allowedApColumns = [
  '*ContactName', 'EmailAddress',
  'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4',
  'POCity', 'PORegion', 'POPostalCode', 'POCountry',
  '*InvoiceNumber', '*InvoiceDate', '*DueDate', 'Total',
  'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount',
  '*AccountCode', '*TaxType', 'TaxAmount',
  'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2',
  'Currency', 'Trans #'
];

let uploadedBankTransferPath = '';

const uploadBankTransfer = (req, res) => {
  uploadedBankTransferPath = req.file.path;
  res.json({ message: 'Bank Transfer file uploaded successfully.' });
};

const cleanNumber = (val) => {
  if (typeof val === 'string') return parseFloat(val.replace(/,/g, '').trim()) || 0;
  return parseFloat(val) || 0;
};

const extractSixDigitCode = (text) => {
  if (!text) return '';
  const digits = text.replace(/\D/g, ''); // Remove non-digits
  return digits.substring(0, 6); // Take first 6 digits
};
const parseCSV = (filePath) => new Promise((resolve, reject) => {
  const results = [];
  createReadStream(filePath)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', () => resolve(results))
    .on('error', reject);
});

const convertBankTransfer = async (req, res) => {
  try {
    if (!existsSync(uploadedBankTransferPath)) {
      return res.status(400).json({ error: 'Bank Transfer file not found.' });
    }

    const rows = await parseCSV(uploadedBankTransferPath);
    const creditRows = [];
    const mainRows = [];

    for (let row of rows) {
      const dr = cleanNumber(row['Debit']);
      const cr = cleanNumber(row['Credit']);
      row['Amount'] = dr - cr;

      if (cr !== 0) {
        creditRows.push({ ...row });
      } else {
        mainRows.push({ ...row });
      }
    }

    const fromBankLookup = {};
    creditRows.forEach(row => {
      if (row['Trans #']) {
        fromBankLookup[row['Trans #']] = row['Account'];
      }
    });

    const bankTransfers = [];
    const arRows = [];
    const apRows = [];
    const transferSpendRows = [];

    for (let row of mainRows) {
      const type = (row['Account Type'] || '').toLowerCase();
      const transNo = row['Trans #'] || '';
      const dr = cleanNumber(row['Debit']);
      const cr = cleanNumber(row['Credit']);
      const amount = dr - cr;

      const baseRow = {
        'Date': row['Date'] || '',
        'Contact Name': 'No Name',
        'Reference': row['Num'] || '',
        'Description': 'Funds Transfer',
        'item Account Code': '',
        'Bank Account Code': '',
        'Line Amount': amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
        'Tax Rate': 'BAS Excluded',
        'Tax Amount': '',
        'line Amount Types': 'Exclusive',
        'Tracking Name 1': '',
        'Tracking Option 1': '',
        'Tracking Name 2': '',
        'Tracking Option 2': '',
        'Currency Code': '',
        'Exchange Rate': row['Exchange Rate'] || '',
        'Trans #': transNo
      };

      if (type.includes('bank') || type.includes('credit card')) {
        bankTransfers.push({
          'Bank Transfer Date': row['Date'] || '',
          'Amount': amount,
          'Reference': row['Num'] || '',
          'From Bank Account Name': extractSixDigitCode(fromBankLookup[transNo]),
          'To Bank Account Name': extractSixDigitCode(row['Account']),
          'Exchange Rate': row['Exchange Rate'] || '',
          'Trans #': transNo
        });
      } else if (type.includes('accounts receivable')) {
        const arRow = {
          '*InvoiceDate': row['Date'] || '',
          '*DueDate': row['Date'] || ''
        };
        Object.entries(arMapping).forEach(([src, dest]) => {
          arRow[dest] = row[src] || '';
        });
        arRow['*ContactName'] = arRow['*ContactName']?.trim() || 'No Name';
        arRow['*Quantity'] = 1;
        arRow['*UnitAmount'] = amount;
        arRow['*AccountCode'] = '9999';
        arRow['*TaxType'] = 'BAS Excluded';
        if (!arRow['Description']) arRow['Description'] = '.';
        if (!arRow['*DueDate']) arRow['*DueDate'] = arRow['*InvoiceDate'];
        if (row['TrackingOption1']) arRow['TrackingName1'] = 'Class';
        arRows.push(arRow);

        baseRow['item Account Code'] = '9999';
        baseRow['Bank Account Code'] = extractSixDigitCode(fromBankLookup[transNo]);
        transferSpendRows.push(baseRow);
      } else if (type.includes('accounts payable')) {
        const apRow = {
          '*InvoiceDate': row['Date'] || '',
          '*DueDate': row['Date'] || ''
        };
        Object.entries(apMapping).forEach(([src, dest]) => {
          apRow[dest] = row[src] || '';
        });
        apRow['*ContactName'] = apRow['*ContactName']?.trim() || 'No Name';
        apRow['*Quantity'] = 1;
        apRow['*UnitAmount'] = -amount;
        apRow['*AccountCode'] = '9999';
        apRow['*TaxType'] = 'BAS Excluded';
        if (!apRow['Description']) apRow['Description'] = '.';
        if (!apRow['*DueDate']) apRow['*DueDate'] = apRow['*InvoiceDate'];
        if (row['TrackingOption1']) apRow['TrackingName1'] = 'Class';
        apRows.push(apRow);

        baseRow['item Account Code'] = '9999';
        baseRow['Bank Account Code'] = extractSixDigitCode(fromBankLookup[transNo]);
        transferSpendRows.push(baseRow);
      } else {
        baseRow['item Account Code'] = extractSixDigitCode(row['Account']);
        baseRow['Bank Account Code'] = extractSixDigitCode(fromBankLookup[transNo]);
        transferSpendRows.push(baseRow);
      }
    }

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'converted_bank_transfer.csv'), new Parser({ fields: allowedBankTransferColumns }).parse(bankTransfers));
    writeFileSync(join(outputDir, 'converted_ar_transfer.csv'), new Parser({ fields: allowedArColumns }).parse(arRows));
    writeFileSync(join(outputDir, 'converted_ap_transfer.csv'), new Parser({ fields: allowedApColumns }).parse(apRows));
    writeFileSync(join(outputDir, 'transfer_spend_money.csv'), new Parser({ fields: allowedTransferSpendColumns }).parse(transferSpendRows));

    return res.json({
      message: 'All files converted successfully.',
      downloadLinks: {
        bankTransfer: '/download-transfer/converted_bank_transfer.csv',
        arTransfer: '/download-transfer/converted_ar_transfer.csv',
        apTransfer: '/download-transfer/converted_ap_transfer.csv',
        transferSpend: '/download-transfer/transfer_spend_money.csv'
      }
    });

  } catch (err) {
    console.error('Bank Transfer Conversion Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// const downloadBankTransfer = (req, res) => {
//   const fileName = req.params.filename;
//   const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);

//   if (!existsSync(filePath)) {
//     return res.status(404).json({ error: 'File not found' });
//   }

//   res.download(filePath, fileName, (err) => {
//     if (err) {
//       console.error('Download error:', err);
//       res.status(500).json({ error: 'Download failed' });
//     }
//   });
// };

const downloadBankTransfer =  (_req, res) => {

  const files = [
    "converted_bank_transfer.csv",
    "converted_ar_transfer.csv",
    "converted_ap_transfer.csv",
    "transfer_spend_money.csv"
  ];

  const zipName = 'conversion_data.zip';
  res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
  res.setHeader('Content-Type', 'application/zip');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  files.forEach(file => {
    const filePath = join(process.cwd(), DOWNLOAD_DIR, file);
    if (existsSync(filePath)) {
      archive.append(createReadStream(filePath), { name: file });
    }
  });

  archive.finalize();
};


export  {
  uploadBankTransfer,
  convertBankTransfer,
  downloadBankTransfer
};

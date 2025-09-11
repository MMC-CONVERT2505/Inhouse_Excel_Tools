import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';
import archiver from 'archiver';
// const archiver = require('archiver');

const reckonToXeroTaxMapping = {
  GST: 'GST on Expenses',
  FRE: 'GST Free Expenses',
  NCG: 'GST on Expenses',
  NCF: 'GST Free Expenses'
};

const spendMoneyMapping = {
  'Date': 'Date',
  'Source Name': 'Contact Name',
  'Num': 'Reference',
  'Description': 'Description',
  'Line Amount': 'Line Amount',
  'Account': 'Item Account Code',
  'Tax Code': 'Tax Rate',
  'Tax Amount': 'Tax Amount',
  'Class': 'Tracking Option 1',
  'line Amount Types': 'Line Amount Types',
  'Trans #': 'Trans #',
  'Debit': 'Debit',
  'Credit': 'Credit',
  'Bank Account Code':'Bank Account Code'
};

const allowedSpendMoneyColumns = [
  'Date', 'Contact Name', 'Reference', 'Description', 'Item Account Code',
  'Bank Account Code', 'Line Amount', 'Tax Rate', 'Tax Amount', 'Line Amount Types',
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

const allowedApColumns =[
  '*ContactName', 'EmailAddress',
  'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4',
  'POCity', 'PORegion', 'POPostalCode', 'POCountry',
  '*InvoiceNumber', '*InvoiceDate', '*DueDate', 'Total',
  'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount',
   '*AccountCode', '*TaxType', 'TaxAmount',
  'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2',
  'Currency', 'Trans #'
];

const bankTransferMapping = {
  'Date': 'Bank Transfer Date',
  'Amount': 'Amount',
  'Num': 'Reference',
  'BANK': 'From Bank Account Name',
  'Account': 'To Bank Account Name',
  'Trans #': 'Trans #',
};

const allowedBankTransferColumns = [
  'Bank Transfer Date', 'Amount', 'Reference',
  'From Bank Account Name', 'To Bank Account Name', 'Exchange Rate','Trans #'
];

let uploadedSpendMoneyPath = '';

const uploadSpendMoney = (req, res) => {
  uploadedSpendMoneyPath = req.file.path;
  res.json({ message: 'Spend Money file uploaded successfully.' });
};

const cleanNumber = (val) => {
  if (typeof val === 'string') return parseFloat(val.replace(/,/g, '').trim()) || 0;
  return parseFloat(val) || 0;
};

const convertSpendMoney = async (req, res) => {
  try {
    if (!existsSync(uploadedSpendMoneyPath)) {
      return res.status(400).json({ error: 'Spend Money file not found.' });
    }

    const rows = await parseCSV(uploadedSpendMoneyPath);
    const spendRows = [], transferRows = [], arRows = [], apRows = [], bankTransfers = [];
    const bankAccountCodeLookup = {};
    const bankNameLookup = {};

    for (let row of rows) {
      const dr = cleanNumber(row['Debit']);
      const cr = cleanNumber(row['Credit']);
      row['Line Amount'] = dr - cr;

      const accType = (row['Account Type'] || '').toLowerCase();
      const transNo = row['Trans #'];

      if ((row['Sales Price'] || '').includes('%')) continue;

      if (accType.includes('bank') && cr > 0) {
        const bankCode = (row['Account'] || '').toString().split(' ')[0];
        bankAccountCodeLookup[transNo] = bankCode;
        bankNameLookup[transNo] = bankCode;
        continue;
      }
    }

    const mainFilteredRows = rows.filter(row => {
      const accType = (row['Account Type'] || '').toLowerCase();
      const cr = cleanNumber(row['Credit']);
      return !(accType.includes('bank') && cr > 0) && !(row['Sales Price'] || '').includes('%');
    });

    for (let row of mainFilteredRows) {
      const transNo = row['Trans #'];
      const accType = (row['Account Type'] || '').toLowerCase();
      const dr = cleanNumber(row['Debit']);
      const cr = cleanNumber(row['Credit']);

      if (accType.includes('accounts receivable')) {
        const arRow = {};
        arRow['*InvoiceDate'] = row['Date'] || '';
        arRow['*DueDate'] = row['Date'] || ''; // Duplicate mapping from same source
        Object.entries(arMapping).forEach(([src, dest]) => {
          arRow[dest] = row[src] || '';
        });
        arRow['*Quantity'] = 1;
        arRow['*UnitAmount'] = dr - cr;
        arRow['*AccountCode'] = '9999';
        arRow['*TaxType'] = 'BAS Excluded';
        if (!arRow['*Description']) arRow['*Description'] = '.';
        if (!arRow['*DueDate']) arRow['*DueDate'] = arRow['*InvoiceDate'];
        if (row['TrackingOption1']) {
          arRow['TrackingName1'] = 'Class';
        }
        arRows.push(arRow);
        row['Account'] = '9999'; // ✅ Set 9999 for AR
        
      }

      if (accType.includes('accounts payable')) {
        const apRow = {};
        apRow['*InvoiceDate'] = row['Date'] || '';
        apRow['*DueDate'] = row['Date'] || ''; // Duplicate mapping from same source
        Object.entries(apMapping).forEach(([src, dest]) => {
          apRow[dest] = row[src] || '';
        });
        apRow['*Quantity'] = 1;
        apRow['*UnitAmount'] = -dr + cr;
        apRow['*AccountCode'] = '9999';
        apRow['*TaxType'] = 'BAS Excluded';
        if (!apRow['*Description']) apRow['*Description'] = '.';
        if (!apRow['*DueDate']) apRow['*DueDate'] = apRow['*InvoiceDate'];
        if (row['TrackingOption1']) {
          apRow['TrackingName1'] = 'Class';
        }
        apRows.push(apRow);
        row['Account'] = '9999'; // ✅ Set 9999 for AP
       
      }
      if (accType.includes('bank')) {
        const bankRow = {};
        Object.entries(bankTransferMapping).forEach(([src, dest]) => {
          let value = '';
        
          if (src === 'BANK') {
            value = bankNameLookup[transNo] || '';
          } else if (src === 'Account') {
            value = (row['Account'] || '').toString().replace(/\D/g, '');
          } else {
            value = row[src] || '';
          }
        
          bankRow[dest] = value;
        });
        bankTransfers.push(bankRow);
        transferRows.push({ ...row });
        continue;
      }

      if (row['Tracking Option 1']) row['Tracking Name 1'] = 'Class';
      row['Tax Code'] = reckonToXeroTaxMapping[row['Tax Code']] || 'BAS Excluded';
      row['line Amount Types'] = 'Exclusive';
      row['Bank Account Code'] = bankAccountCodeLookup[transNo] || (row['Account']?.split(' ')[0] || '');

      const mappedRow = {};
      Object.entries(spendMoneyMapping).forEach(([src, dest]) => {
        let value = row[src] || '';
        if (["Line Amount", "Tax Amount", "Debit", "Credit"].includes(dest)) {
          const parsed = parseFloat(value);
          value = isNaN(parsed)
              ? (dest === 'Tax Amount' ? '' : '0.00')
              : parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      // Fix blank contact names
      if (!mappedRow['Contact Name'] || mappedRow['Contact Name'].trim() === '') {
          mappedRow['Contact Name'] = 'No Name';
      }
        if (dest === 'Item Account Code') value = value.split(' ')[0];
        mappedRow[dest] = value;
      });

      allowedSpendMoneyColumns.forEach(col => {
        if (!(col in mappedRow)) mappedRow[col] = '';
      });

      spendRows.push(mappedRow);
    }

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
    mkdirSync(outputDir, { recursive: true });

    writeFileSync(join(outputDir, 'converted_spend_money.csv'), new Parser({ fields: allowedSpendMoneyColumns }).parse(spendRows));
    writeFileSync(join(outputDir, 'converted_ar_spend_money.csv'), new Parser({ fields: allowedArColumns }).parse(arRows));
    writeFileSync(join(outputDir, 'converted_ap_spend_money.csv'), new Parser({ fields: allowedApColumns }).parse(apRows));
    writeFileSync(join(outputDir, 'converted_transfer.csv'), new Parser({ fields: allowedBankTransferColumns }).parse(bankTransfers));

    return res.json({
      message: 'Spend Money, AR, AP, and Bank Transfer files converted.',
      downloadLinks: {
        spendMoney: '/download-spend-money/converted_spend_money.csv',
        arSpend: '/download-spend-money/converted_ar_spend_money.csv',
        apSpend: '/download-spend-money/converted_ap_spend_money.csv',
        transfer: '/download-spend-money/converted_transfer.csv'
      }
    });
  } catch (err) {
    console.error('Conversion error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// const downloadSpendMoney = (req, res) => {
//   const fileName = req.params.filename;
//   const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);

//   if (!existsSync(filePath)) {
//     return res.status(404).json({ error: 'File not found' });
//   }

//   res.download(filePath, fileName, (err) => {
//     if (err) {
//       console.error('Error downloading:', err);
//       res.status(500).json({ error: 'Download failed' });
//     }
//   });
// };

const downloadSpendMoney =  (_req, res) => {

  const files = [
    "converted_spend_money.csv",
    "converted_ar_spend_money.csv",
    "converted_ap_spend_money.csv",
    "converted_transfer.csv",
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


const parseCSV = (filePath) => new Promise((resolve, reject) => {
  const results = [];
  createReadStream(filePath)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', () => resolve(results))
    .on('error', reject);
});

export  { uploadSpendMoney, convertSpendMoney, downloadSpendMoney };



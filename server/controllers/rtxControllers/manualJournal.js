import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';
import archiver from 'archiver';

// 1. Manual Journal Mapping
const manualJournalMapping = {
  'Num': 'Narration',
  'Date': 'Date',
  'Description': 'Description',
  'Account': 'Account Code',
  'Class': 'tracking 1 Option',
  'Trans #': 'Trans #'
};
const allowedManualJournalColumns = [
  'Narration', 'Date', 'Description', 'Account Code',
  'Line Amount', 'Tax Rate', 'Tax Amount', 'Line Amount Types',
  'tracking 1 Name', 'tracking 1 Option',
  'tracking 2 Name', 'tracking 2 Option',
  'Status', 'Trans #'
];

// 2. Spend Money Mapping
const spendMoneyMapping = {
  'Date': 'Date',
  'Name': 'Contact Name',
  'Num': 'Reference',
  'Description': 'Description',
  'Account': 'Bank Account Code',
  'Credit': 'Line Amount',
  'Trans #': 'Trans #'
};
const allowedSpendMoneyColumns = [
  'Date', 'Contact Name', 'Reference', 'Description', 'Item Account Code', 'Bank Account Code',
  'Line Amount', 'Tax Rate', 'Tax Amount', 'Line Amount Types',
  'Tracking Name 1', 'Tracking Option 1',
  'Tracking Name 2', 'Tracking Option 2',
  'Currency Code', 'Exchange Rate', 'Trans #'
];

// 3. Receive Money Mapping
const receiveMoneyMapping = {
  'Date': 'Date',
  'Name': 'Contact Name',
  'Num': 'Reference',
  'Description': 'Description',
  'Account': 'Bank Account Code',
  'Debit': 'Line Amount',
  'Class': 'Tracking Option 1',
  'Trans #': 'Trans #'
};
const allowedReceiveMoneyColumns = [
  'Date', 'Contact Name', 'Reference', 'Description', 'Item Account Code', 'Bank Account Code',
  'Line Amount', 'Tax Rate', 'Tax Amount', 'Line Amount Types',
  'Tracking Name 1', 'Tracking Option 1',
  'Tracking Name 2', 'Tracking Option 2',
  'Currency Code', 'Exchange Rate', 'Trans #'
];

// 4. AR Mapping
const arMapping = {
  'Name': '*ContactName',
  'Num': '*InvoiceNumber',
  'Trans #': 'Reference',
  'Date': '*InvoiceDate',
  'Date2': '*DueDate',
  'Description': '*Description',
  'Account': '*AccountCode',
  'Class': 'TrackingOption1',
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

// 5. AP Mapping
const apMapping = {
  'Name': '*ContactName',
  'Num': '*InvoiceNumber',
  'Date': '*InvoiceDate',
  'Date2': '*DueDate',
  'Description': '*Description',
  'Account': '*AccountCode',
  'Class': 'TrackingOption1',
  'Trans #': 'Trans #'
};

const allowedApColumns = [
  '*ContactName', 'EmailAddress',
  'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4',
  'POCity', 'PORegion', 'POPostalCode', 'POCountry',
  '*InvoiceNumber',  '*InvoiceDate', '*DueDate', 'Total',
  'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount',
  'Discount', '*AccountCode', '*TaxType', 'TaxAmount',
  'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2',
  'Currency', 'Trans #'
];

let uploadedManualJournalFilePath = '';

const uploadManualJournal = (req, res) => {
  uploadedManualJournalFilePath = req.file.path;
  console.log("Uploaded Manual Journal File Path: ", uploadedManualJournalFilePath);
  res.json({ message: 'Manual Journal file uploaded successfully.' });
};

const convertManualJournal = async (req, res) => {
  try {
    if (!existsSync(uploadedManualJournalFilePath)) {
      return res.status(400).json({ error: 'Uploaded manual journal file not found.' });
    }

    const cleanNumber = (value) => {
      if (typeof value === 'string') {
        return parseFloat(value.replace(/,/g, '').trim()) || 0;
      }
      return parseFloat(value) || 0;
    };

    const extractOnlyNumber = (value) => {
      const match = String(value).match(/\d+/);
      return match ? match[0] : '';
    };

    const originalRows = await parseCSV(uploadedManualJournalFilePath);
    const manualJournalRows = [];
    const spendMoneyRows = [];
    const receiveMoneyRows = [];
    const arRows = [];
    const apRows = [];

    for (const row of originalRows) {
      const debit = cleanNumber(row['Debit']);
      const credit = cleanNumber(row['Credit']);
      const accountType = (row['Account Type'] || '').toLowerCase();

      const trackingOption1 = row['Tracking Option 1'] || row['TrackingOption1'] || '';
      row['Tracking Name 1'] = trackingOption1 ? 'Class' : '';

      let accountCode = row['Account'] || '';
      if (['accounts receivable', 'accounts payable', 'bank', 'credit card'].some(type => accountType.includes(type))) {
        accountCode = '9999';
      }
      row['Account'] = accountCode;

      if (row['Bank Account Code']) {
        row['Bank Account Code'] = row['Bank Account Code'].replace(/\D/g, '');
      }

      if (!row['Description'] || row['Description'].trim() === '') {
        row['Description'] = '.';
      }

      if (row['Invoice Date']) {
        row['Due Date'] = row['Invoice Date'];
      }

      const amtManual = debit - credit;
      const amtSpend = credit;
      const amtReceive = debit;

      // Manual Journal
      if (amtManual !== 0) {
        const manualRow = {};
        Object.entries(manualJournalMapping).forEach(([src, tgt]) => {
          manualRow[tgt] = row[src] || '';
        });

        const code = manualRow['Account Code'];
        manualRow['Account Code'] = extractOnlyNumber(code);
        manualRow['Line Amount'] = amtManual;
        manualRow['Tax Rate'] = 'BAS Excluded';
        manualRow['Tax Amount'] = '';
        manualRow['Line Amount Types'] = 'Exclusive';
        manualRow['tracking 1 Option'] = '';
        manualRow['tracking 2 Name'] = '';
        manualRow['tracking 2 Option'] = '';
        manualRow['Status'] = 'DRAFT';
        manualJournalRows.push(manualRow);
      }

      // Spend Money
      if ((accountType.includes('bank') || accountType.includes('credit card')) && amtSpend !== 0) {
        const spendRow = {};
        Object.entries(spendMoneyMapping).forEach(([src, tgt]) => {
          spendRow[tgt] = row[src] || '';
        });
        spendRow['Contact Name'] = spendRow['Contact Name'] || 'No Name';
        spendRow['Item Account Code'] = '9999';
        spendRow['Bank Account Code'] = row['Bank Account Code'] || ''; 
        spendRow['Tax Rate'] = 'BAS Excluded';
        spendRow['Tax Amount'] = '';
        spendRow['line Amount Types'] = 'Exclusive';
        spendMoneyRows.push(spendRow);
      }

      // Receive Money
      if ((accountType.includes('bank') || accountType.includes('credit card')) && amtReceive !== 0) {
        const receiveRow = {};
        Object.entries(receiveMoneyMapping).forEach(([src, tgt]) => {
          receiveRow[tgt] = row[src] || '';
        });
        receiveRow['Contact Name'] = receiveRow['Contact Name'] || 'No Name';
        receiveRow['Item Account Code'] = '9999';
        receiveRow['Bank Account Code'] = row['Bank Account Code'] || '';
        receiveRow['Tax Rate'] = 'BAS Excluded';
        receiveRow['Tax Amount'] = '';
        receiveRow['line Amount Types'] = 'Exclusive';
        receiveMoneyRows.push(receiveRow);
      }

      // AR
      if (accountType.includes('accounts receivable')) {
        const arRow = {};
        Object.entries(arMapping).forEach(([src, tgt]) => {
          arRow[tgt] = row[src] || '';
        });
        arRow['*Quantity'] = 1;
        arRow['*UnitAmount'] = debit - credit;
        arRow['*DueDate'] = arRow['*InvoiceDate'];
        arRow['*AccountCode'] = '9999';
        arRow['*TaxType'] = 'BAS Excluded';
        arRow['TrackingName1'] = arRow['TrackingOption1'] ? 'Class' : '';
        arRows.push(arRow);
      }


      // AP
      if (accountType.includes('accounts payable')) {
        const apRow = {};
        Object.entries(apMapping).forEach(([src, tgt]) => {
          apRow[tgt] = row[src] || '';
        });
        apRow['*Quantity'] = 1;
        apRow['*UnitAmount'] = -debit + credit;
        apRow['*AccountCode'] = '9999';
        apRow['*DueDate'] = apRow['*InvoiceDate'];
        apRow['*TaxType'] = 'BAS Excluded';
        apRow['TrackingName1'] = apRow['TrackingOption1'] ? 'Class' : '';
        apRows.push(apRow);
      }
    }

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
    mkdirSync(outputDir, { recursive: true });

    writeFileSync(join(outputDir, 'converted_manual_journal.csv'), new Parser({ fields: allowedManualJournalColumns }).parse(manualJournalRows));
    writeFileSync(join(outputDir, 'converted_spend_money_manual.csv'), new Parser({ fields: allowedSpendMoneyColumns }).parse(spendMoneyRows));
    writeFileSync(join(outputDir, 'converted_receive_money_manual.csv'), new Parser({ fields: allowedReceiveMoneyColumns }).parse(receiveMoneyRows));
    writeFileSync(join(outputDir, 'converted_ar_manual.csv'), new Parser({ fields: allowedArColumns }).parse(arRows));
    writeFileSync(join(outputDir, 'converted_ap_manual.csv'), new Parser({ fields: allowedApColumns }).parse(apRows));

    return res.json({
      message: 'Manual Journal, Spend Money, Receive Money, AR, AP converted successfully.',
      
      downloadLinks: {
        manualJournal: `/download-manual-journal/converted_manual_journal.csv`,
        spendMoneyManual: `/download-manual-journal/converted_spend_money_manual.csv`,
        receiveMoneyManual: `/download-manual-journal/converted_receive_money_manual.csv`,
        arManual: `/download-manual-journal/converted_ar_manual.csv`,
        apManual: `/download-manual-journal/converted_ap_manual.csv`
      }
      
    });

  } catch (error) {
    console.error('Error during manual journal conversion:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const downloadManualJournal =  (_req, res) => {

  const files = [
    'converted_manual_journal.csv',
    'converted_spend_money_manual.csv',
    'converted_receive_money_manual.csv',
    'converted_ar_manual.csv',
    'converted_ap_manual.csv',
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

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export  { uploadManualJournal, convertManualJournal, downloadManualJournal };

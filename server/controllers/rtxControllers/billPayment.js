import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

// Mapping from Reckon to Xero as per the image
const billPaymentMapping = {
  'TxnDate': 'Date',
  'RefNumber': 'Reference',
  'AppliedToTxnAmount': 'Amount',
  'AppliedToTxnRefNumber': 'Invoice Number',
  'BankAccountRefFullName': 'Account',
  'AppliedToTxnTxnID': 'AppliedToTxnTxnID',
  'AppliedToTxnTxnType': 'AppliedToTxnTxnType',
  'TxnNumber': 'TxnNumber'
};

const allowedBillPaymentColumns = [
    'Date',
    'Reference',
    'Amount',
    'Invoice Number',
    'Credit Note Number',
    'Exchange Rate',
    'Account',
    'AppliedToTxnTxnID',
    'AppliedToTxnTxnType',
    'TxnNumber',
  ];
  
let uploadedBillPaymentFilePath = '';

const uploadBillPayment = (req, res) => {
  uploadedBillPaymentFilePath = req.file.path;
  console.log("Uploaded Bill Payment File Path:", uploadedBillPaymentFilePath);
  res.json({ message: 'Bill Payment file uploaded successfully.' });
};

const convertBillPayment = async (req, res) => {
  try {
    if (!existsSync(uploadedBillPaymentFilePath)) {
      return res.status(400).json({ error: 'Uploaded bill payment file not found.' });
    }

    const originalRows = await parseCSV(uploadedBillPaymentFilePath);
    const cleanedRows = [];

    for (const row of originalRows) {
      const xeroRow = {};

      Object.entries(billPaymentMapping).forEach(([sourceKey, targetKey]) => {
        let value = row[sourceKey];

        // Default fallback if Contact or other fields are missing
        if (targetKey === 'Account' && (!value || value.trim() === '')) {
          value = 'No Name';
        }

        xeroRow[targetKey] = value ?? '';
      });

      allowedBillPaymentColumns.forEach(col => {
        if (!(col in xeroRow)) {
          xeroRow[col] = '';
        }
      });

      cleanedRows.push(xeroRow);
    }


    const parser = new Parser({ fields: allowedBillPaymentColumns });
    const csvOutput = parser.parse(cleanedRows);

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
    mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_bill_payment.csv';
    const outputPath = join(outputDir, fileName);
    writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'Bill Payment data converted successfully.',
      downloadLink: `/download-bill-payment/${fileName}`,
      fileName
    });

  } catch (error) {
    console.error('Error during bill payment conversion:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const downloadBillPayment = (req, res) => {
  const fileName = req.params.filename;
  const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Error downloading:', err);
      res.status(500).json({ error: 'Download failed' });
    }
  });
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

export  { uploadBillPayment, convertBillPayment, downloadBillPayment };

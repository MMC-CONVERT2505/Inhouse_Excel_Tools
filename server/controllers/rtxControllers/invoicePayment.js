import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

// Mapping as per the image for Invoice Payment
const invoicePaymentMapping = {
  'TxnDate': 'Date',
  'RefNumber': 'Reference',
  'AppliedToTxnAmount': 'Amount',
  'AppliedToTxnRefNumber': 'Invoice Number',
  'DepositToAccountRefFullName': 'Account',
  'AppliedToTxnTxnID': 'AppliedToTxnID',
  'AppliedToTxnTxnType': 'AppliedToTxnType',
  'TxnNumber': 'TxnNumber'
};

const allowedInvoicePaymentColumns =  [
    'Date',
    'Reference',
    'Amount',
    'Invoice Number',
    'Credit Note Number',
    'Exchange Rate',
    'Account',
    'AppliedToTxnID',
    'AppliedToTxnType',
    'TxnNumber',
  ];

let uploadedInvoicePaymentFilePath = '';

const uploadInvoicePayment = (req, res) => {
  uploadedInvoicePaymentFilePath = req.file.path;
  console.log("Uploaded Invoice Payment File Path:", uploadedInvoicePaymentFilePath);
  res.json({ message: 'Invoice Payment file uploaded successfully.' });
};

const convertInvoicePayment = async (req, res) => {
  try {
    if (!existsSync(uploadedInvoicePaymentFilePath)) {
      return res.status(400).json({ error: 'Uploaded invoice payment file not found.' });
    }

    const originalRows = await parseCSV(uploadedInvoicePaymentFilePath);
    const cleanedRows = [];

    for (const row of originalRows) {
      const xeroRow = {};

      Object.entries(invoicePaymentMapping).forEach(([sourceKey, targetKey]) => {
        let value = row[sourceKey];

        if (targetKey === 'Account' && (!value || value.trim() === '')) {
          value = 'No Name';
        }

        xeroRow[targetKey] = value ?? '';
      });

      allowedInvoicePaymentColumns.forEach(col => {
        if (!(col in xeroRow)) {
          xeroRow[col] = '';
        }
      });

      cleanedRows.push(xeroRow);
    }

    const parser = new Parser({ fields: allowedInvoicePaymentColumns });
    const csvOutput = parser.parse(cleanedRows);

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
    mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_invoice_payment.csv';
    const outputPath = join(outputDir, fileName);
    writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'Invoice Payment data converted successfully.',
      downloadLink: `/download-invoice-payment/${fileName}`,
      fileName
    });

  } catch (error) {
    console.error('Error during invoice payment conversion:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const downloadInvoicePayment = (req, res) => {
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

export {
  uploadInvoicePayment,
  convertInvoicePayment,
  downloadInvoicePayment
};




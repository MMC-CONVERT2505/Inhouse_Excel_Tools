import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';


// Reckon to Xero column mapping for AR Invoices
const reckonToXeroARMapping = {
  'Name': '*ContactName',
  'Num': '*InvoiceNumber',
  'Trans #': 'Reference',
  'Date': '*InvoiceDate',
  'Due Date': '*DueDate',
  'Description': '*Description',
  'Quantity': '*Quantity',
  'Open Balance': '*UnitAmount',
};

// Required Xero columns
const allowedARColumns = [
  '*ContactName', 'EmailAddress',
  'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4',
  'POCity', 'PORegion', 'POPostalCode', 'POCountry',
  '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate',
  'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount',
  'Discount', '*AccountCode', '*TaxType', 'TaxAmount',
  'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2',
  'Currency', 'BrandingTheme','Status',               
  'LineAmountTypes'
];

// Helper to clean values
const cleanValue = (val) => {
  if (val === '*' || val === undefined || val === null || val.toString().trim() === '') {
    return null;
  }
  return val;
};

// Upload path holder
let uploadedARFilePath = '';

// Upload handler
const uploadARInvoice = (req, res) => {
  uploadedARFilePath = req.file.path;
  console.log("Uploaded AR Invoice File Path: ", uploadedARFilePath);
  res.json({ message: 'Reckon AR Invoice file uploaded successfully.' });
};

const convertARInvoice = async (req, res) => {
  try {
    if (!fs.existsSync(uploadedARFilePath)) {
      return res.status(400).json({ error: 'Uploaded AR file not found.' });
    }

    const reckonRows = await parseCSV(uploadedARFilePath);

     // 🔸 Filter out rows where 'Type' is blank or empty
    const filteredRows = reckonRows.filter(row => {
      const typeVal = (row['Type'] || '').trim();
      return typeVal !== '';
    });

    const invoiceNumberCounts = {}; // Track invoice number occurrences

    const convertedRows = filteredRows.map((reckonRow) => {
      const xeroRow = {};

      Object.entries(reckonToXeroARMapping).forEach(([reckonKey, xeroKey]) => {
        let value = cleanValue(reckonRow[reckonKey]);

        // Force Quantity to at least 1
        if (xeroKey === '*Quantity') {
          value = parseFloat(value) || 1;
        }

        // Force Description to `.`
        if (xeroKey === '*Description') {
          value = '.';
        }

        xeroRow[xeroKey] = value;
      });

      // Handle missing InvoiceNumber using Trans #
      if (!xeroRow['*InvoiceNumber']) {
        xeroRow['*InvoiceNumber'] = cleanValue(reckonRow['Trans #']) || 'UNKNOWN';
      }

      // Count and modify duplicate InvoiceNumbers
      const invoiceKey = xeroRow['*InvoiceNumber'];
      if (invoiceNumberCounts[invoiceKey]) {
        invoiceNumberCounts[invoiceKey] += 1;
        // Append Trans# to make unique
        const transNumber = cleanValue(reckonRow['Trans #']) || 'DUP';
        xeroRow['*InvoiceNumber'] = `${invoiceKey}_${transNumber}`;
      } else {
        invoiceNumberCounts[invoiceKey] = 1;
      }

      // Add all required columns
      allowedARColumns.forEach(col => {
        if (!(col in xeroRow)) xeroRow[col] = null;
      });

      // Static values
      xeroRow['*AccountCode'] = '9999';
      xeroRow['*TaxType'] = 'BAS Excluded';
      xeroRow['Status'] = 'DRAFT';
      xeroRow['LineAmountTypes'] = 'Exclusive';

      return xeroRow;
    });

    const parser = new Parser({ fields: allowedARColumns });
    const csvOutput = parser.parse(convertedRows);

    const outputDir = path.resolve(process.cwd(), DOWNLOAD_DIR);
    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_ar_invoice.csv';
    const outputPath = path.join(outputDir, fileName);

    fs.writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'AR Invoice data converted successfully.',
      downloadLink: `/download-ar-invoice/${fileName}`,
      fileName
    });

  } catch (err) {
    console.error('Error during AR conversion:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


// Download handler
const downloadARInvoice = (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(process.cwd(), DOWNLOAD_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Download failed' });
    }
  });
};

// CSV parser
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}


export  {
  uploadARInvoice,
  convertARInvoice,
  downloadARInvoice
};

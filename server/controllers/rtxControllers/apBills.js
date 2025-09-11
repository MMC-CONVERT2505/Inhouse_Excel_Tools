import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

// Mapping Reckon fields to Xero fields
const reckonToXeroAPBillMapping = {
  'Name': '*ContactName',
  'Trans #': 'Trans #',
  'Num': '*InvoiceNumber',
  'Date': '*InvoiceDate',
  'Due Date': '*DueDate',
  'Open Balance': '*UnitAmount',
};

const allowedAPBillColumns = [
  '*ContactName', 'EmailAddress',
  'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4',
  'POCity', 'PORegion', 'POPostalCode', 'POCountry',
  '*InvoiceNumber','*InvoiceDate', '*DueDate','Total',
  'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount',
  '*AccountCode', '*TaxType', 'TaxAmount','TrackingName1',
  'TrackingOption1', 'TrackingName2','TrackingOption2', 'Currency',  'Status',      
  'LineAmountTypes' ,'Trans #',
];

// Helper function to clean values
const cleanValue = (val) => {
  if (val === '*' || val === undefined || val === null || val.toString().trim() === '') {
    return null;
  }
  return val;
};

// File upload path holder
let uploadedAPBillPath = '';

// Upload handler
const uploadAPBill = (req, res) => {
  uploadedAPBillPath = req.file.path;
  console.log("Uploaded AP Bill File Path: ", uploadedAPBillPath);
  res.json({ message: 'Reckon AP Bill file uploaded successfully.' });
};


const convertAPBill = async (req, res) => {
  try {
    if (!fs.existsSync(uploadedAPBillPath)) {
      return res.status(400).json({ error: 'Uploaded AP Bill file not found.' });
    }

    const reckonRows = await parseCSV(uploadedAPBillPath);

    // 🔸 Filter out rows where 'Type' is blank or empty
    const filteredRows = reckonRows.filter(row => {
      const typeVal = (row['Type'] || '').trim();
      return typeVal !== '';
    });

    const invoiceNumberCounts = {};

    const convertedRows = filteredRows.map((reckonRow) => {
      const xeroRow = {};

      Object.entries(reckonToXeroAPBillMapping).forEach(([reckonKey, xeroKey]) => {
        let value = cleanValue(reckonRow[reckonKey]);
        xeroRow[xeroKey] = value;
      });

      if (!xeroRow['*InvoiceNumber']) {
        xeroRow['*InvoiceNumber'] = cleanValue(reckonRow['Trans #']) || 'UNKNOWN';
      }

      const invoiceKey = xeroRow['*InvoiceNumber'];
      if (invoiceNumberCounts[invoiceKey]) {
        invoiceNumberCounts[invoiceKey] += 1;
        const transNumber = cleanValue(reckonRow['Trans #']) || 'DUP';
        xeroRow['*InvoiceNumber'] = `${invoiceKey}_${transNumber}`;
      } else {
        invoiceNumberCounts[invoiceKey] = 1;
      }

      // Fixed/default values
      xeroRow['*Quantity'] = 1;
      xeroRow['*Description'] = '.';
      xeroRow['*AccountCode'] = '9999';
      xeroRow['*TaxType'] = 'BAS Excluded';
      xeroRow['Status'] = 'DRAFT';
      xeroRow['LineAmountTypes'] = 'Exclusive';

      // Ensure all allowed columns are present
      allowedAPBillColumns.forEach(col => {
        if (!(col in xeroRow)) xeroRow[col] = null;
      });

      return xeroRow;
    });

    const parser = new Parser({ fields: allowedAPBillColumns });
    const csvOutput = parser.parse(convertedRows);

    const outputDir = path.resolve(process.cwd(), DOWNLOAD_DIR);
    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_ap_bills.csv';
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'AP Bill data converted successfully (rows with blank Type removed).',
      downloadLink: `/download-ap-bill/${fileName}`,
      fileName
    });

  } catch (error) {
    console.error('Error during AP Bill conversion:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


// Download handler
const downloadAPBill = (req, res) => {
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

// Parse CSV utility
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


export  { uploadAPBill, convertAPBill, downloadAPBill };

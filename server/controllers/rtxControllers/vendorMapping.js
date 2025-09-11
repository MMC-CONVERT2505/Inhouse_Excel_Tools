import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR, CONVERTED_VENDOR_FILE_NAME } from '../../config/config.mjs';

// Mapping Reckon fields to Xero fields
const reckonToXeroColumnMapping = {
  'Supplier': 'ContactName',
  'Account No.': 'AccountNumber',
  'Email': 'EmailAddress',
  'First Name': 'First Name',
  'Last Name': 'Last Name',
  'Company': 'POAttentionTo',
  'Street1': 'POAddressLine1',
  'Street2': 'POAddressLine2',
  'City': 'POCity',
  'State': 'PORegion',
  'Post Code': 'POPostalCode',
  'Country': 'POCountry',
  'Phone': 'PhoneNumber',
  'Fax': 'FaxNumber',
  'Alt. Phone': 'MobileNumber',
  'Tax ID': 'TaxNumber',
  'Terms': 'DueDateBillTerm',
};



// Required Xero columns
const allowedColumns = [
  "ContactName", "AccountNumber", "EmailAddress", "First Name", "Last Name", "POAttentionTo", "POAddressLine1", "POAddressLine2",
  "POAddressLine3", "POAddressLine4", "POCity", "PORegion", "POPostalCode", "POCountry", "SAAttentionTo", "SAAddressLine1", "SAAddressLine2",
  "SAAddressLine3", "SAAddressLine4", "SACity", "SARegion", "SAPostalCode", "SACountry", "PhoneNumber", "FaxNumber", "MobileNumber",
  "DDINumber", "SkypeName", "BankAccountName", "BankAccountNumber", "BankAccountParticulars", "TaxNumber", "AccountsReceivableTaxCodeName",
  "AccountsPayableTaxCodeName", "Website", "Discount", "DueDateBillDay", "DueDateBillTerm", "DueDateSalesDay", "DueDateSalesTerm",
  "SalesAccount", "PurchasesAccount", "TrackingName1", "SalesTrackingOption1", "PurchasesTrackingOption1", "TrackingName2",
  "SalesTrackingOption2", "PurchasesTrackingOption2", "BrandingTheme", "DefaultTaxBills", "DefaultTaxSales",
];

// Helper
const cleanValue = (val) => {
  if (val === '*' || val === undefined || val === null || val.toString().trim() === '') {
    return null;
  }
  return val;
};

// File upload reference
let uploadedVendorFilePath = '';

// Upload route handler
const uploadVendor = (req, res) => {
  uploadedVendorFilePath = req.file.path;
  console.log("Uploaded Vendor File Path: ", uploadedVendorFilePath);
  res.json({ message: 'Reckon Vendor file uploaded successfully.' });
};

// Convert route handler
const convertVendor = async (req, res) => {
  try {
    if (!existsSync(uploadedVendorFilePath)) {
      return res.status(400).json({ error: 'Uploaded vendor file not found.' });
    }

    const reckonRows = await parseCSV(uploadedVendorFilePath);

    const convertedRows = reckonRows.map((reckonRow) => {
      const xeroRow = {};

      Object.entries(reckonToXeroColumnMapping).forEach(([reckonKey, xeroKey]) => {
        xeroRow[xeroKey] = cleanValue(reckonRow[reckonKey]);
      });

      allowedColumns.forEach(col => {
        if (!(col in xeroRow)) xeroRow[col] = null;
      });

      return xeroRow;
    });

    const parser = new Parser({ fields: allowedColumns });
    const csvOutput = parser.parse(convertedRows);

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
    mkdirSync(outputDir, { recursive: true });

    const fileName =  'converted_vendor.csv';
    const outputPath = join(outputDir, fileName);
    writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'Vendor data converted successfully.',
      downloadLink: `/download-vendor/${fileName}`,
      fileName
    });

  } catch (err) {
    console.error('Error during vendor conversion:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Download handler
const downloadVendor = (req, res) => {
  const fileName = req.params.filename;
  const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Download failed' });
    }
  });
};

// CSV Parser
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

export{ uploadVendor, convertVendor, downloadVendor };

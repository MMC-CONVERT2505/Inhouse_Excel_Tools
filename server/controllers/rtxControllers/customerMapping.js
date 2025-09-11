import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR, CONVERTED_CUSTOMER_FILE_NAME } from '../../config/config.mjs'; 

// Mapping and allowed columns
const reckonToXeroColumnMapping = {
  'Customer': 'ContactName',
  'AccountNo': 'AccountNumber',
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
  'Ship To Street1': 'SAAddressLine1',
  'Ship To Street2': 'SAAddressLine2',
  'Ship To City': 'SACity',
  'Ship To State': 'SARegion',
  'Ship To Post Code': 'SAPostalCode',
  'Ship To Country': 'SACountry',
  'Phone': 'PhoneNumber',
  'Fax': 'FaxNumber',
  'Alt. Phone': 'MobileNumber',
  'Resale Num': 'TaxNumber',
  'Terms': 'DueDateSalesTerm',
};

const allowedColumns = [
  "ContactName", "AccountNumber", "EmailAddress", "First Name", "Last Name", "POAttentionTo", "POAddressLine1", "POAddressLine2",
  "POAddressLine3", "POAddressLine4", "POCity", "PORegion", "POPostalCode", "POCountry", "SAAttentionTo", "SAAddressLine1", "SAAddressLine2",
  "SAAddressLine3", "SAAddressLine4", "SACity", "SARegion", "SAPostalCode", "SACountry", "PhoneNumber", "FaxNumber", "MobileNumber",
  "DDINumber", "SkypeName", "BankAccountName", "BankAccountNumber", "BankAccountParticulars", "TaxNumber", "AccountsReceivableTaxCodeName",
  "AccountsPayableTaxCodeName", "Website", "Discount", "DueDateBillDay", "DueDateBillTerm", "DueDateSalesDay", "DueDateSalesTerm",
  "SalesAccount", "PurchasesAccount", "TrackingName1", "SalesTrackingOption1", "PurchasesTrackingOption1", "TrackingName2",
  "SalesTrackingOption2", "PurchasesTrackingOption2", "BrandingTheme", "DefaultTaxBills", "DefaultTaxSales",
];

// Utils
const cleanValue = (val) => {
  if (val === '*' || val === undefined || val === null || val.toString().trim() === '') {
    return null;
  }
  return val;
};

let uploadedCustomerFilePath = '';

// Upload handler
const uploadCustomer = (req, res) => {
  uploadedCustomerFilePath = req.file.path;
  console.log("Uploaded Customer File Path: ", uploadedCustomerFilePath);
  res.json({ message: 'Reckon Customer file uploaded successfully.' });
};

// Conversion handler
const convertCustomer = async (req, res) => {
  try {
    if (!existsSync(uploadedCustomerFilePath)) {
      return res.status(400).json({ error: 'Uploaded customer file not found.' });
    }

    const reckonRows = await parseCSV(uploadedCustomerFilePath);

    const convertedRows = reckonRows.map(row => {
      const xeroRow = {};

      Object.entries(reckonToXeroColumnMapping).forEach(([rKey, xKey]) => {
        xeroRow[xKey] = cleanValue(row[rKey]);
      });

      allowedColumns.forEach(col => {
        if (!(col in xeroRow)) xeroRow[col] = null;
      });

      return xeroRow;
    });

    const parser = new Parser({ fields: allowedColumns });
    const csvOutput = parser.parse(convertedRows);

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR || 'conversions/downloads');
    mkdirSync(outputDir, { recursive: true });

    const fileName = CONVERTED_CUSTOMER_FILE_NAME || 'converted_customer.csv';
    const outputPath = join(outputDir, fileName);
    writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'Customer data converted successfully.',
       fileName
      //      fileName: fileName, 
      // downloadLink: `/download-customer/${fileName}`
      // downloadLink: `/api/excel-australia-reckondesktop/hostedtoxero/singlecurrency/download-customer/${fileName}` // ✅ fixed route
      
    });

  } catch (err) {
    console.error('Customer conversion error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// CSV Parser
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', data => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Download handler
const downloadCustomer = (req, res) => {
  const fileName = req.params.filename;
    // const fileName = req.params;


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

export  { uploadCustomer, convertCustomer, downloadCustomer};






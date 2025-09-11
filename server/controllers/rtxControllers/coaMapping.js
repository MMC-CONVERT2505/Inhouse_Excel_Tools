import { existsSync, createReadStream, mkdirSync, writeFileSync } from 'fs';
import { resolve as _resolve, join } from 'path';
import { Parser } from 'json2csv';
import csv from 'csv-parser';
import { XERO_FILE_PATH, DOWNLOAD_DIR, CONVERTED_FILE_NAME } from '../../config/config.mjs';

// Type Mapping
const reckonToXeroTypeMapping = {
  'Asset': 'Current Asset',
  'Other Asset': 'Current Asset',
  'Accounts Payable': 'Accounts Payable',
  'Accounts Receivable': 'Accounts Receivable',
  'Bank': 'Bank',
  'Cost of Goods Sold': 'Direct Costs',
  'Credit Card': 'Bank',
  'Equity': 'Equity',
  'Expense': 'Expense',
  'Fixed Asset': 'Fixed Asset',
  'Income': 'Revenue',
  'Liability': 'Liability',
  'Long Term Liability': 'Liability',
  'Other Current Asset': 'Current Asset',
  'Other Current Liability': 'Current Liability',
  'Other Expense': 'Expense',
  'Other Income': 'Other Income',
  'Other Liability': 'Current Liability',
  'Non-Posting': 'Current Liability',
};

const reckonToXeroTaxMapping = {
  'CAP': 'GST on Capital',
  'FRE': 'GST Free Income',  // Overwrites previous
  'GST': 'GST on Income',    // Overwrites previous
  'IMP': 'GST on Imports',
  'INP': 'Input Taxed',
  'N-T': 'BAS Excluded',
  'EXP': 'BAS Excluded',
  'ITS': 'BAS Excluded',
  'NCF': 'GST Free Income',  // Overwrites previous
  'NCG': 'GST on Income'     // Overwrites previous
};

// Value mapping
const mapReckonToXero = (reckonData) => {
  return reckonData.map((reckonRow) => {
    const mappedType = reckonToXeroTypeMapping[reckonRow['Type']] || reckonRow['Type'];
    const taxCode = reckonRow['Code'];
    const accountType = mappedType;

    const mappedRow = {
      Code: reckonRow['Accnt. #'],
      Name: reckonRow['Account'],
      Type: mappedType,
      "Tax Code": 'BAS Excluded',
      Description: (reckonRow['Description'] && reckonRow['Description'].trim() !== '') ? reckonRow['Description'] : '.',
      Dashboard: ['Bank', 'Credit Card'].includes(reckonRow['Type']) ? 'Yes' : 'No',
      ExpenseClaims: 'No',
      EnablePayments: 'No',
      Balance: null
    };

    if (reckonToXeroTaxMapping[taxCode]) {
      mappedRow["Tax Code"] = reckonToXeroTaxMapping[taxCode];
    }

    if (!taxCode || taxCode.trim() === '' || ['EXP', 'ITS'].includes(taxCode)) {
      mappedRow["Tax Code"] = 'BAS Excluded';
    }

    if (['Direct Costs', 'Expense', 'Current Liability'].includes(accountType)) {
      if (taxCode === 'GST' || taxCode === 'NCG') mappedRow["Tax Code"] = 'GST on Expenses';
      if (taxCode === 'FRE' || taxCode === 'NCF') mappedRow["Tax Code"] = 'GST Free Expenses';
    }

    if (['Income', 'Current Asset', 'Fixed Asset'].includes(accountType)) {
      if (taxCode === 'GST' || taxCode === 'NCG') mappedRow["Tax Code"] = 'GST on Income';
      if (taxCode === 'FRE' || taxCode === 'NCF') mappedRow["Tax Code"] = 'GST Free Income';
    }

    if (reckonRow['Account'] === '*Undeposited Funds') {
      mappedRow.Type = 'Bank';
      mappedRow.Dashboard = 'Yes';
    }

        if (reckonRow['Account'] === 'Undeposited Funds') {
      mappedRow.Type = 'Bank';
      mappedRow.Dashboard = 'Yes';
    }

    if(reckonRow[Type] === 'Suspense'){
      mappedRow.Type = 'Current Liability';
     
    }

    return mappedRow;
  });
};

// Upload path variable
let uploadedReckonFilePath = '';

// Upload handler
const uploadCOA = (req, res) => {
  uploadedReckonFilePath = req.file.path;
  console.log("Uploaded COA File Path: ", uploadedReckonFilePath);
  res.json({ message: 'Reckon COA file uploaded successfully.' });
};

// Conversion handler
const convertCOA = async (req, res) => {
  try {
    if (!existsSync(uploadedReckonFilePath)) {
      return res.status(400).json({ error: 'Uploaded COA file not found.' });
    }

    const reckonData = [];
    const xeroReferenceData = [];
    
    await new Promise((resolve, reject) => {
      createReadStream(uploadedReckonFilePath)
      
        .pipe(csv())
        .on('data', (row) => reckonData.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
  console.log("Uploaded Customer File Path: ", uploadedReckonFilePath);
if (existsSync(XERO_FILE_PATH)) {
  await new Promise((resolve, reject) => {
    createReadStream(XERO_FILE_PATH)
      .pipe(csv())
      .on('data', (row) => xeroReferenceData.push(row))
      .on('end', resolve)
      .on('error', reject);
  });
} 

    const mappedData = mapReckonToXero(reckonData);
    const parser = new Parser();
    const csvData = parser.parse(mappedData);

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR || 'conversions/downloads');
    mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_COA.csv';
    const outputPath = join(outputDir, fileName);

    writeFileSync(outputPath, csvData);

    return res.json({
      message: 'Chart of Accounts data converted successfully.',
      downloadLink: `/download-coa/${fileName}`,
      fileName
    });

  } catch (error) {
    console.error('COA conversion error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Download handler
const downloadCOA = (req, res) => {
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

export  {
  uploadCOA,
  convertCOA,
  downloadCOA
};



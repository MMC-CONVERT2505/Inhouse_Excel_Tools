import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { parse } from 'json2csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData = [];

const typeMapping = {
  'Current Asset': 'Current Asset',
  'Fixed Asset': 'Fixed Asset',
  'Inventory': 'Inventory',
  'Non-current Asset': 'Non-current Asset',
  'Prepayment': 'Prepayment',
  'Equity': 'Equity',
  'Bank': 'Bank',
  'Credit card': 'Bank',
  'Depreciation': 'Depreciation',
  'Direct Costs': 'Direct Costs',
  'Expense': 'Expense',
  'Overhead': 'Overhead',
  'Current Liability': 'Current Liability',
  'Liability': 'Liability',
  'Non-current Liability': 'Non-current Liability',
  'Other Income': 'Other Income',
  'Revenue': 'Revenue',
  'Sales': 'Sales',
  'Accounts Payable': 'Accounts Payable',
  'Accounts Receivable': 'Accounts Receivable'
};

const excludedNames = [
  'Accounts Receivable',
  'Trade Creditors',
  'GST',
  'Retained Earnings',
  'Rounding',
  'Accounts Payable',
  'Trade Debtor',
  'Historical Adjustment',
  'Tracking Transfers',
  'Unpaid Expense Claims'
];

// Normalize headers: remove *, trim, lowercase
const normalizeHeader = (header) => header.replace(/\*/g, '').trim();

const applyTypeMapping = (row) => {
  const oldType = row['Type'];
  if (oldType && typeMapping[oldType]) row['Type'] = typeMapping[oldType];
  return row;
};

const applyDashboardMapping = (row) => {
  row['Dashboard'] = (row['Type'] === 'Bank' || row['Type'] === 'Credit card') ? 'Yes' : 'No';
  return row;
};

const applyTaxMapping = (row) => {
  const taxCodeMap = {
    'BASEXCLUDED': 'BAS Excluded',
    'EXEMPTEXPENSES': 'GST Free Expenses',
    'EXEMPTOUTPUT': 'GST Free Income',
    'INPUT': 'GST on Expenses',
    'OUTPUT': 'GST on Income',
    'BAS EXCLUDED': 'BAS Excluded',
    'GST FREE EXPENSES': 'GST Free Expenses',
    'GST FREE INCOME': 'GST Free Income',
    'GST ON EXPENSES': 'GST on Expenses',
    'GST ON INCOME': 'GST on Income',
    'TAX EXEMPT': 'Tax Exempt'
  };

  let oldTax = row['Tax Code']?.toUpperCase().trim();
  let accountType = row['Type'];

  if (oldTax && taxCodeMap[oldTax]) {
    row['Tax Code'] = taxCodeMap[oldTax];
  } else {
    if (['Expense', 'Other Income'].includes(accountType)) {
      row['Tax Code'] = 'BAS Excluded';
    }
  }
  return row;
};

const applyDefaultNoColumns = (row) => {
  row['Expense Claims'] = 'No';
  row['Enable Payments'] = 'No';
  return row;
};

const transformData = (data) => {
  return data
    .filter(row => !excludedNames.includes(row['Name']))
    .map(row => {
      row = applyTypeMapping(row);
      row = applyTaxMapping(row);
      row = applyDashboardMapping(row);
      row = applyDefaultNoColumns(row);
      return row;
    });
};

const coaHandler = (req, res) => {
  uploadedData = [];

  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const headersMap = {};
  let expectedColumnCount = 0;
  let rowError = false;

  createReadStream(req.file.path)
    .pipe(csv({
      mapHeaders: ({ header }) => {
        const cleaned = normalizeHeader(header);
        headersMap[header] = cleaned;
        return cleaned;
      }
    }))
    .on('headers', (headers) => {
      expectedColumnCount = headers.length;
    })
    .on('data', (rawRow) => {
      if (Object.keys(rawRow).length !== expectedColumnCount) {
        rowError = true;
        return;
      }
      uploadedData.push(rawRow);
    })
    .on('end', () => {
      unlinkSync(req.file.path);

      if (rowError) {
        uploadedData = [];
        return res.status(400).json({ message: 'CSV format error: inconsistent column count.' });
      }

      res.json({ message: 'File uploaded and parsed successfully.' });
    });
};

const convertHandler = (req, res) => {
  if (!uploadedData || uploadedData.length === 0) {
    return res.status(400).json({ message: 'No data to convert' });
  }

  const transformed = transformData(uploadedData);
  const csvString = parse(transformed);

  const outputDir = join(__dirname, '../converted');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, 'converted.csv');
  writeFileSync(outputPath, csvString);

  res.json({ message: 'Data converted successfully.' });
};

const downloadHandler = (req, res) => {
  const file = join(__dirname, '../converted/converted.csv');
  if (existsSync(file)) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="converted.csv"');
    res.download(file);
  } else {
    res.status(404).json({ message: 'Converted file not found' });
  }
};

export {
  coaHandler,
  convertHandler,
  downloadHandler
};


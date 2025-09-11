
import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

// Mapping
const reckonToXeroColumnMapping = {
  'Item': ['ItemCode', 'ItemName'],
  'Purchase Description': 'PurchasesDescription',
  'Cost': 'PurchasesUnitPrice',
  'COGS Account': 'PurchasesAccount',
  'Description': 'SalesDescription',
  'Price': 'SalesUnitPrice',
  'Account': 'SalesAccount',
  'Tax Code': 'SalesTaxRate',
};

const allowedColumns = [
  'ItemCode',
  'ItemName',
  'PurchasesDescription',
  'PurchasesUnitPrice',
  'PurchasesAccount',
  'PurchasesTaxRate',
  'SalesDescription',
  'SalesUnitPrice',
  'SalesAccount',
  'SalesTaxRate',
  'InventoryAssetAccount',
  'CostOfGoodsSoldAccount'
];

const taxCodeMapping = {
  'FRE': 'GST Free Income',
  'GST': 'GST on Income',
  'NCF': 'GST Free Income',
  'NCG': 'GST on Income'
};

// Utils
const cleanValue = (val) => {
  if (val === '*' || val === undefined || val === null || val.toString().trim() === '') {
    return null;
  }
  return val;
};

const mapSimpleTaxCode = (taxCode) => {
  const code = (taxCode || '').trim().toUpperCase();
  return taxCodeMapping[code] || code;
};

const cleanSalesAccount = (account) => {
  if (!account) return '';
  if (account.includes(':')) {
    const afterColon = account.split(':')[1];
    const match = afterColon.match(/\d+/);
    return match ? match[0] : '';
  } else {
    const match = account.match(/\d+/);    
    return match ? match[0] : '';
  }
};

// Upload handler
let uploadedItemFilePath = '';

const uploadItem = (req, res) => {
  uploadedItemFilePath = req.file.path;
  console.log("Uploaded Item File Path: ", uploadedItemFilePath);
  res.json({ message: 'Reckon Item file uploaded successfully.' });
};

// Conversion handler
const convertItem = async (req, res) => {
  try {
    if (!existsSync(uploadedItemFilePath)) {
      return res.status(400).json({ error: 'Uploaded item file not found.' });
    }

    const originalRows = await parseCSV(uploadedItemFilePath);
    const convertedRows = [];

    for (const row of originalRows) {
      const xeroRow = {};

      Object.entries(reckonToXeroColumnMapping).forEach(([reckonKey, xeroKeys]) => {
        let value = cleanValue(row[reckonKey]);

        if (Array.isArray(xeroKeys)) {
          xeroKeys.forEach((key) => {
            xeroRow[key] = value;
          });
        } else {
          if (xeroKeys === 'SalesTaxRate') value = mapSimpleTaxCode(value);
          if (xeroKeys === 'SalesAccount') value = cleanSalesAccount(value);
          xeroRow[xeroKeys] = value;
        }
      });

      allowedColumns.forEach(col => {
        if (!(col in xeroRow)) xeroRow[col] = null;
      });

      convertedRows.push(xeroRow);
    }

    const parser = new Parser({ fields: allowedColumns });
    const csvOutput = parser.parse(convertedRows);

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR || 'conversions/downloads');
    mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_item.csv';
    const outputPath = join(outputDir, fileName);
    writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'Item data converted successfully.',
          fileName: fileName, 
      downloadLink: `/download-item/${fileName}`
    });

  } catch (error) {
    console.error('Error during item conversion:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// CSV parser
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

// Download
const downloadItem = (req, res) => {
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

export  {
  uploadItem,
  convertItem,
  downloadItem
};

import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

const inventoryAdjustMapping = {
  'Num': 'Narration',
  'Date': 'Date',
  'Description': 'Description',
  'Trans #': 'Trans #'
};

const allowedInventoryColumns = [
  'Narration', 'Date', 'Description', 'Account Code',
  'Line Amount', 'Tax Rate', 'Tax Amount', 'Line Amount Types',
  'tracking 1 Name', 'tracking 1 Option', 'tracking 2 Name', 'tracking 2 Option',
  'Status', 'Trans #'
];

let uploadedInventoryAdjustFilePath = '';

const uploadInventoryAdjust = (req, res) => {
  uploadedInventoryAdjustFilePath = req.file.path;
  console.log("Uploaded Inventory Adjust File Path:", uploadedInventoryAdjustFilePath);
  res.json({ message: 'Inventory Adjustment file uploaded successfully.' });
};

const convertInventoryAdjust = async (req, res) => {
  try {
    if (!existsSync(uploadedInventoryAdjustFilePath)) {
      return res.status(400).json({ error: 'Uploaded inventory adjustment file not found.' });
    }

    const originalRows = await parseCSV(uploadedInventoryAdjustFilePath);
    const cleanedRows = [];

    const cleanNumber = (value) => {
      if (typeof value === 'string') {
        return parseFloat(value.replace(/,/g, '').trim()) || 0;
      }
      return parseFloat(value) || 0;
    };

    for (const row of originalRows) {
      const debit = cleanNumber(row['DR'] || row['Debit']);
      const credit = cleanNumber(row['CR'] || row['Credit']);
      const lineAmount = +(debit - credit).toFixed(2);

      // Skip if line amount is zero
      if (lineAmount === 0) continue;

      const xeroRow = {};

      // Map all direct fields except Account Code
      Object.entries(inventoryAdjustMapping).forEach(([sourceKey, targetKey]) => {
        xeroRow[targetKey] = row[sourceKey] || '';
      });

      // ✅ Extract clean numeric Account Code
      let accountRaw = (row['Account'] || '').trim();
      let accountCode = '';

      if (accountRaw.includes(':')) {
        const afterColon = accountRaw.split(':').pop();
        const match = afterColon.match(/\d+/);
        accountCode = match ? match[0] : '';
      } else {
        const match = accountRaw.match(/\d+/);
        accountCode = match ? match[0] : '';
      }

      // ❌ Skip row if Account Code is missing
      if (!accountCode) continue;

      xeroRow['Account Code'] = accountCode;

      // Fixed values
      xeroRow['Line Amount'] = lineAmount;
      xeroRow['Tax Rate'] = 'BAS Excluded';
      xeroRow['Tax Amount'] = '';
      xeroRow['Line Amount Types'] = 'Exclusive';
      xeroRow['tracking 2 Name'] = '';
      xeroRow['tracking 2 Option'] = '';
      xeroRow['Status'] = 'DRAFT';

      // Tracking class handling
      const classValue = row['Class']?.trim() || '';
      if (classValue) {
        xeroRow['tracking 1 Name'] = 'Class';
        xeroRow['tracking 1 Option'] = classValue;
      } else {
        xeroRow['tracking 1 Name'] = '';
        xeroRow['tracking 1 Option'] = '';
      }

      // Ensure all columns exist
      allowedInventoryColumns.forEach(col => {
        if (!(col in xeroRow)) { 
          xeroRow[col] = '';
        }
      });

      cleanedRows.push(xeroRow);
    }

    const parser = new Parser({ fields: allowedInventoryColumns });
    const csvOutput = parser.parse(cleanedRows);

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
    mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_inventory_adjust.csv';
    const outputPath = join(outputDir, fileName);
    writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'Inventory Adjustment data converted successfully.',
      downloadLink: `/download-inventory-adjust/${fileName}`,
      fileName
    });

  } catch (error) {
    console.error('Error during inventory adjustment conversion:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const downloadInventoryAdjust = (req, res) => {
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

export  {
  uploadInventoryAdjust,
  convertInventoryAdjust,
  downloadInventoryAdjust
};

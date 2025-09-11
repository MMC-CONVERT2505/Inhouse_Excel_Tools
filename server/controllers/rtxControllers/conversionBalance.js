import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

// Final output column headers
const allowedConversionColumns = ['Account Code', 'Balance', 'Conversion Date'];

// Mapping for special accounts
const accountNameToCode = {
  'accounts receivable': '610',
  'trade receivables': '610',
  'accounts payable': '800',
  'trade creditors': '800',
  'tax payable': '820',
  'opening bal equity': '3000',
  'retained earnings': '960'
};

let uploadedConversionBalancePath = '';

const uploadConversionBalance = (req, res) => {
  uploadedConversionBalancePath = req.file.path;
  console.log("Uploaded Conversion Balance File Path:", uploadedConversionBalancePath);
  res.json({ message: 'Conversion Balance file uploaded successfully.' });
};

const convertConversionBalance = async (req, res) => {
  try {
    if (!fs.existsSync(uploadedConversionBalancePath)) {
      return res.status(400).json({ error: 'Uploaded conversion balance file not found.' });
    }

    const rawRows = await parseCSV(uploadedConversionBalancePath);
    if (!rawRows.length) return res.status(400).json({ error: 'CSV is empty or invalid format' });

    const headers = Object.keys(rawRows[0]);
    const accountCol = headers[0];
    const secondColHeader = headers[1]?.trim();
    const thirdColHeader = headers[2]?.trim();

    // Convert date like 'Jun 30, 24' to '2024-06-30'
    const conversionDate = convertDate(secondColHeader);

    const cleanNumber = (val) => {
      if (typeof val === 'string') return parseFloat(val.replace(/,/g, '').trim()) || 0;
      return parseFloat(val) || 0;
    };

    const cleanedRows = [];

    for (const row of rawRows) {
      const name = (row[accountCol] || '').toString().trim();
      const debit = cleanNumber(row[secondColHeader]);
      const credit = cleanNumber(row[thirdColHeader]);

      const balance = +(debit - credit).toFixed(2);
      if (balance === 0 || !name) continue;

      let accountCode = '';

      // Try mapped names first
      const lowered = name.toLowerCase();
      for (const keyword in accountNameToCode) {
        if (lowered.includes(keyword)) {
          accountCode = accountNameToCode[keyword];
          break;
        }
      }

      // If no mapping found, extract numeric account code from the front
  if (!accountCode) {
  const parts = name.split(':');
  const lastPart = parts[parts.length - 1];
  const match = lastPart.match(/\b\d+\b/);
  accountCode = match ? match[0] : '';

  // Fallback: use starting number if nothing found
  if (!accountCode) {
    const startMatch = name.match(/^\d+/);
    accountCode = startMatch ? startMatch[0] : '';
  }
}
      if (!accountCode) continue;

      cleanedRows.push({
        'Account Code': accountCode,
        'Balance': balance,
        'Conversion Date': conversionDate
      });
    }

    const parser = new Parser({ fields: allowedConversionColumns });
    const csvOutput = parser.parse(cleanedRows);

    const outputDir = path.resolve(process.cwd(), DOWNLOAD_DIR);
    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_conversion_balance.csv';
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'Conversion Balance data converted successfully.',
      downloadLink: `/download-conversion-balance/${fileName}`,
      fileName
    });

  } catch (error) {
    console.error('Error during conversion balance processing:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const downloadConversionBalance = (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(process.cwd(), DOWNLOAD_DIR, fileName);

  if (!fs.existsSync(filePath)) {
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
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Convert 'Jun 30, 24' → '2024-06-30'
function convertDate(dateStr) {
  try {
    const parsed = new Date(dateStr);
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

export  {
  uploadConversionBalance,
  convertConversionBalance,
  downloadConversionBalance
};

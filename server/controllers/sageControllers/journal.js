import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import xlsx from 'xlsx';  

const { utils, readFile, writeFile, SSF } = xlsx; 
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// const { utils, readFile, writeFile } = xlsx;

let uploadedJournalPath = '';

// ✅ Create Upload Directory
const uploadDir = join('uploads', 'journal');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, 'journal_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// ✅ Journal Upload Handler
const handleJournalUpload = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    uploadedJournalPath = req.file.path;
    console.log('Uploaded Journal:', uploadedJournalPath);
    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ✅ Helper Functions
function calculateAmount(debit, credit) {
  return parseFloat(debit || 0) - parseFloat(credit || 0);
}

function parseExcelDate(dateVal) {
  if (typeof dateVal === 'number') {
    const parsed = SSF.parse_date_code(dateVal);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
  } else if (typeof dateVal === 'string') {
    let d = new Date(dateVal);
    if (!isNaN(d)) return d;
    const parts = dateVal.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (parts) {
      let day = parseInt(parts[1], 10);
      let month = parseInt(parts[2], 10) - 1;
      let year = parseInt(parts[3], 10);
      if (year < 100) year += 2000;
      d = new Date(year, month, day);
      if (!isNaN(d)) return d;
    }
  } else if (dateVal instanceof Date) {
    return dateVal;
  }
  return null;
}

function generateJournalNo(type, reference, accDate) {
  const t = (type || '').toLowerCase().trim();
  const refStr = reference ? String(reference).trim() : '';
  const dateObj = parseExcelDate(accDate);

  if ((t.includes('journal') || t === 'vat payment') && dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${dd}${mm}${yyyy}`;
    const combined = `${dateStr}-${refStr}`;
    return combined.length > 21 ? combined.slice(-21) : combined;
  }

  return refStr.length > 21 ? refStr.slice(-21) : refStr;
}

function setDateColumnFormat(ws, col, startRow, endRow) {
  for (let row = startRow; row <= endRow; row++) {
    const cell = ws[`${col}${row}`];
    if (cell) {
      if (typeof cell.v === 'number') {
        const parsed = SSF.parse_date_code(cell.v);
        if (parsed) {
          cell.v = new Date(parsed.y, parsed.m - 1, parsed.d);
          cell.t = 'd';
          cell.z = 'dd/mm/yyyy';
        }
      } else if (cell.v instanceof Date) {
        cell.t = 'd';
        cell.z = 'dd/mm/yyyy';
      }
    }
  }
}

function normalizeRowKeys(row) {
  const newRow = {};
  for (const key in row) {
    const cleanKey = key.toLowerCase().replace(/\s+|\/+/g, '');
    let value = row[key];
    if (typeof value === 'string') {
      value = value.trim();
      if (['transactiontype', 'bankcustomersupplier', 'accountdescription'].includes(cleanKey)) {
        value = value.toLowerCase();
      }
    }
    newRow[cleanKey] = value;
  }
  return newRow;
}

function fillDown(rows, key) {
  let lastValue = '';
  return rows.map(row => {
    if (row[key] && row[key] !== '') {
      lastValue = row[key];
    } else {
      row[key] = lastValue;
    }
    return row;
  });
}

function isValidTransactionType(type) {
  const knownTypes = [
    'journal entry',
    'vat payment',
    'supplier adjustment',
    'customer adjustment',
    'customer write-off'
  ];
  return knownTypes.includes((type || '').toLowerCase().trim());
}

function isValidRow(row) {
  const t = row['transactiontype'];
  const hasDate = row['accountdate'];
  const hasAcc = row['accountdescription'];
  const hasAmt = row['debit'] || row['credit'];
  return isValidTransactionType(t) && hasDate && hasAcc && hasAmt;
}


// ✅ Convert Function
const convertJournal = () => {
  if (!uploadedJournalPath || !fs.existsSync(uploadedJournalPath)) {
    throw new Error('No uploaded journal file found');
  }

  const wb = readFile(uploadedJournalPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  let rawData = utils.sheet_to_json(sheet, { defval: '' });

  rawData = rawData.map(normalizeRowKeys);
  rawData = fillDown(rawData, 'accountdescription');
  const validRows = rawData.filter(isValidRow);

  const knownTypes = [
    'journal entry',
    'vat payment',
    'supplier adjustment',
    'customer adjustment',
    'customer write-off'
  ];

  const newWb = utils.book_new();
  knownTypes.forEach(type => {
    const filtered = validRows.filter(r => r['transactiontype']?.toLowerCase().trim() === type);
    const mapped = filtered.map(row => ({
      'Journal No': generateJournalNo(type, row['reference'], row['accountdate']),
      'Journal Date': parseExcelDate(row['accountdate']),
      'Account': row['accountdescription'],
      'Amount': calculateAmount(row['debit'], row['credit']),
      'Name': row['bankcustomersupplier'] || '',
      'Tax Code': row['taxcode'] || '',
      'Currency Code': row['currency'] || '',
      'Exchange Rate': row['exchangerate'] || '',
      'Description':row['description'] ||''

    }));

    if (mapped.length === 0) {
      mapped.push({
        'Journal No': '',
        'Journal Date': '',
        'Account': '',
        'Amount': '',
        'Name': '',
        'Tax Code': '',
        'Currency Code': '',
        'Exchange Rate': '',
        'Description':''

      });
    }

    const ws = utils.json_to_sheet(mapped);
    setDateColumnFormat(ws, 'B', 2, mapped.length + 1);
    utils.book_append_sheet(newWb, ws, type.slice(0, 31));
  });

  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFile = 'converted_journal_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFile);
  writeFile(newWb, outputPath);

  return outputPath;
};

// ✅ Convert Handler
const handleJournalConvert = (req, res) => {
  try {
    const outputPath = convertJournal();
    res.status(200).json({ message: 'Journal converted', path: outputPath });
  } catch (err) {
    console.error('Conversion failed:', err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Download Handler
const downloadJournal = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_journal_') && file.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtime - fs.statSync(join(convertedDir, a)).mtime);

    if (files.length === 0) {
      return res.status(404).json({ message: 'No converted journal file found' });
    }

    const latestFile = files[0];
    const filePath = join(convertedDir, latestFile);
    res.download(filePath, latestFile);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ message: 'Download failed' });
  }
};

// ✅ EXPORT
export {
  handleJournalUpload,
  handleJournalConvert,
  downloadJournal,
  upload
};

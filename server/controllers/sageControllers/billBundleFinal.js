import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, readFile, writeFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Uploaded file paths
let uploadedPaymentPath = '';
let uploadedSupplierPath = '';
let uploadedCoaPath = '';

// Upload setup
const uploadDir = join('uploads', 'billbundle');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    const uniqueName = `${file.fieldname}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});
const uploadBillBundle = multer({ storage });

// Upload handler (as-is)
const handleBillBundleUpload = (req, res) => {
  try {
    if (!req.files || !req.files.billPayment || !req.files.coa || !req.files.supplier) {
      return res.status(400).json({ message: 'All 3 files (payment, supplier, coa) are required' });
    }

    uploadedPaymentPath = req.files.billPayment[0].path;
    uploadedSupplierPath = req.files.coa[0].path;     // may actually be COA or Supplier
    uploadedCoaPath = req.files.supplier[0].path;     // may actually be Supplier or COA

    console.log('✅ Payment File:', uploadedPaymentPath);
    console.log('✅ Supplier File (raw):', uploadedSupplierPath);
    console.log('✅ COA File (raw):', uploadedCoaPath);

    res.status(200).json({ message: 'Files uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// Helpers
const trim21 = s => (s ? String(s).trim().slice(0, 21) : '');
const toStr = v => (v === undefined || v === null) ? '' : String(v).trim();

const fmtDateYMD = (v) => {
  const d = new Date(v);
  if (isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// locale-safe number parsing
const toNumber = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  let s = String(v).trim();
  if (/,/.test(s) && /\.\d{1,}$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/,/.test(s) && !/\.\d{1,}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

const readSheet = (file) => {
  const wb = readFile(file);
  return utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
};

// Convert handler (Amount = TotalUnallocated, Ref No = Reference) + Journal for negatives; negatives excluded from overpayment
const handleBillBundleConvert = (req, res) => {
  try {
    if (!fs.existsSync(uploadedPaymentPath) ||
        !fs.existsSync(uploadedSupplierPath) ||
        !fs.existsSync(uploadedCoaPath)) {
      throw new Error('Missing one or more uploaded files');
    }

    const payRows = readSheet(uploadedPaymentPath);
    const supRowsRaw = readSheet(uploadedSupplierPath);
    const coaRowsRaw = readSheet(uploadedCoaPath);

    // --- robust mapping (auto-detect + normalization) ---
    const makeIdNameMap = (rows) => {
      const m = {};
      for (const r of rows) {
        const id = toStr(r['ID']);
        const name = toStr(r['Name']);
        if (id) m[id] = name || '';
      }
      return m;
    };

    const mapA = makeIdNameMap(supRowsRaw);
    const mapB = makeIdNameMap(coaRowsRaw);

    const supplierKeys = payRows.map(r => toStr(r['SupplierId'])).filter(Boolean);
    const bankKeys     = payRows.map(r => toStr(r['BankAccountId'])).filter(Boolean);

    const score = (m, keys) => keys.reduce((acc, k) => acc + (m[k] ? 1 : 0), 0);

    const supplierScoreA = score(mapA, supplierKeys);
    const supplierScoreB = score(mapB, supplierKeys);
    const bankScoreA     = score(mapA, bankKeys);
    const bankScoreB     = score(mapB, bankKeys);

    let supMap, coaMap;
    if (supplierScoreA >= supplierScoreB && bankScoreB >= bankScoreA) {
      supMap = mapA; coaMap = mapB;
    } else if (supplierScoreB > supplierScoreA && bankScoreA > bankScoreB) {
      supMap = mapB; coaMap = mapA;
    } else {
      supMap = (supplierScoreA >= supplierScoreB) ? mapA : mapB;
      coaMap = (bankScoreA     >= bankScoreB)     ? mapA : mapB;
    }

    // Step 1: remove rows where TotalUnallocated == 0  (Amount yahi se aayega)
    let filtered = payRows
      .map(r => ({ ...r, __TotalUnallocNum: toNumber(r['TotalUnallocated']) }))
      .filter(r => r.__TotalUnallocNum !== 0);

    // Step 2: sort by DocumentNo A→Z (stable)
    filtered.sort((a, b) => toStr(a['DocumentNo']).localeCompare(toStr(b['DocumentNo'])));

    // Step 3: keep only first occurrence of each DocumentNo  (TRUE set → 10 rows)
    const seen = new Set();
    const kept = filtered.filter(r => {
      const key = toStr(r['DocumentNo']);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Split positives/negatives for overpayment vs journal
    const positives = kept.filter(r => r.__TotalUnallocNum > 0);
    const negatives = kept.filter(r => r.__TotalUnallocNum < 0);

    // ---- Bills sheet (Bill No = DocumentNo; Dates blank like main) ----
    // (Bills unchanged; aapne bills ko change karne ko nahi bola)
    const bills = kept.map(r => ({
      'Bill No': trim21(r['DocumentNo']),
      'Supplier': supMap[toStr(r['SupplierId'])] || 'Unknown Supplier',
      'Bill Date': '',
      'Due Date': '',
      'Expense Account ': 'Retained Earnings',
      'Expense Description': toStr(r['Description']) || '',
      'Expense Line Amount': 0
    }));

    // ---- Overpayment sheet (ONLY positive amounts) ----
    const overpayment = positives.map(r => {
      const docNo = trim21(r['DocumentNo']);
      const vendorName = supMap[toStr(r['SupplierId'])] || 'Unknown Supplier';
      const bankName   = coaMap[toStr(r['BankAccountId'])] || 'Unknown Bank Account';
      return {
        'Ref No': toStr(r['Reference']),
        'Vendor': vendorName,
        'Payment Date': fmtDateYMD(r['Date']),
        'Bank or CC Account': bankName,
        'Memo': toStr(r['Description']),
        'Bill No': docNo,
        'Amount': r.__TotalUnallocNum,                  // positive only
        'Currency Code': toStr(r['Currency Code'] || r['CurrencyCode'] || ''),
        'Exchange Rate': toStr(r['Exchange Rate'] || r['ExchangeRate'] || ''),
        'Print Status': toStr(r['Print Status'] || r['PrintStatus'] || '')
      };
    });

    // ---- Journal sheet (ONLY negative amounts; 2-line entry; Dr/Cr ulta as requested) ----
    const JOURNAL_AP_ACCOUNT = 'Accounts Payable (A/P)';

    const journal = [];
    for (const r of negatives) {
      const absAmt = Math.abs(r.__TotalUnallocNum);
      const vendorName = supMap[toStr(r['SupplierId'])] || 'Unknown Supplier';
      const bankName   = coaMap[toStr(r['BankAccountId'])] || 'Unknown Bank Account';
      const refNo      = toStr(r['Reference']);
      const memo       = toStr(r['Description']);
      const jDate      = fmtDateYMD(r['Date']);

      // Line 1: Dr Bank (abs amount)
      journal.push({
        'Txn Date': jDate,
        'Ref No': refNo,
        'Memo': memo,
        'Account': bankName,
        'Name': '',
        'Debit': absAmt,
        'Credit': 0
      });
      // Line 2: Cr A/P (Vendor)
      journal.push({
        'Txn Date': jDate,
        'Ref No': refNo,
        'Memo': memo,
        'Account': JOURNAL_AP_ACCOUNT,
        'Name': vendorName,
        'Debit': 0,
        'Credit': absAmt
      });
    }

    // Save combined workbook
    const outDir = join(__dirname, '..', 'converted');
    mkdirSync(outDir, { recursive: true });
    const outFile = `converted_bundle_${Date.now()}.xlsx`;
    const outPath = join(outDir, outFile);

    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(bills), 'bills');
    utils.book_append_sheet(wb, utils.json_to_sheet(overpayment), 'overpayment');
    if (journal.length) {
      utils.book_append_sheet(wb, utils.json_to_sheet(journal), 'journal');
    }
    writeFile(wb, outPath);

    console.log('✅ Bundle converted:', outPath);
    res.status(200).json({
      message: 'Conversion successful',
      path: outPath,
      counts: {
        kept_rows: kept.length,
        positives_in_overpayment: positives.length,
        negatives_for_journal: negatives.length,
        journal_lines: journal.length,
        journal_entries: journal.length / 2
      }
    });
  } catch (e) {
    console.error('Conversion error:', e);
    res.status(500).json({ message: e.message });
  }
};

// Download handler (as-is)
const downloadBillBundle = (req, res) => {
  try {
    const dir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('converted_bundle_') && f.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(dir, b)).mtime - fs.statSync(join(dir, a)).mtime);
    if (!files.length) return res.status(404).json({ message: 'No converted file found' });
    const latest = files[0];
    res.download(join(dir, latest), latest);
  } catch (e) {
    res.status(500).json({ message: 'Download failed' });
  }
};

export {
  uploadBillBundle,
  handleBillBundleUpload,
  handleBillBundleConvert,
  downloadBillBundle
};

// server/controllers/sageControllers/invoiceOverpayment.js
import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, readFile, writeFile, SSF } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------- Uploaded paths ----------------
let uploadedInvoicePaymentPath = '';
let uploadedCoaPath = '';

// ---------------- Upload setup ----------------
const uploadDir = join('uploads', 'invoice_overpayment');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${file.fieldname}_${Date.now()}${ext}`);
  }
});
const uploadInvoiceOverpayment = multer({ storage });
// use: uploadInvoiceOverpayment.fields([{ name: 'invoicePayment', maxCount: 1 }, { name: 'coa', maxCount: 1 }])

// ---------------- Upload handler ----------------
const handleInvoiceOverpaymentUpload = (req, res) => {
  try {
    if (!req.files?.invoicePayment || !req.files?.coa) {
      return res.status(400).json({ message: 'Files required: invoicePayment, coa' });
    }
    uploadedInvoicePaymentPath = req.files.invoicePayment[0].path;
    uploadedCoaPath = req.files.coa[0].path;
    console.log('✅ Invoice Payment file:', uploadedInvoicePaymentPath);
    console.log('✅ COA file:', uploadedCoaPath);
    res.status(200).json({ message: 'Files uploaded successfully' });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// ---------------- Helpers ----------------
const toStr = v => (v === undefined || v === null) ? '' : String(v).trim();
const trim21 = s => (s ? String(s).trim().slice(0, 21) : '');

// locale-safe number parsing
const parseNumber = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (s === '') return 0;
  if (/,/.test(s) && /\.\d{1,}$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/,/.test(s) && !/\.\d{1,}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

// Excel serial + common formats → dd/mm/yyyy
function formatDate(v) {
  try {
    if (v === undefined || v === null || v === '') return '';
    if (typeof v === 'number') {
      const d = SSF.parse_date_code(v);
      if (!d) return '';
      return `${String(d.d||1).padStart(2,'0')}/${String(d.m||1).padStart(2,'0')}/${d.y||new Date().getFullYear()}`;
    }
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return '';
      if (/^\d+(\.\d+)?$/.test(s)) {
        const d = SSF.parse_date_code(Number(s));
        if (d) return `${String(d.d||1).padStart(2,'0')}/${String(d.m||1).padStart(2,'0')}/${d.y||new Date().getFullYear()}`;
      }
      const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m1) {
        const dd = +m1[1], mm = +m1[2], yy = m1[3].length === 2 ? 2000 + +m1[3] : +m1[3];
        const d = new Date(yy, mm-1, dd);
        if (!isNaN(d)) return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      }
      const d = new Date(s);
      if (!isNaN(d)) return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      return '';
    }
    const d = new Date(v);
    return isNaN(d) ? '' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return ''; }
}

const readFirstSheet = (file) => {
  const wb = readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return utils.sheet_to_json(ws, { defval: '' });
};

// canonical key for DocumentNo
const strongDocKey = (v) => toStr(v).toUpperCase().trim().replace(/[\s\-_./\\]+/g, '');

// case-insensitive header pickers
const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
  }
  const canon = Object.fromEntries(Object.keys(obj).map(k=>[k.toLowerCase().replace(/\s+/g,''), k]));
  for (const k of keys) {
    const kk = k.toLowerCase().replace(/\s+/g,'');
    if (canon[kk] && String(obj[canon[kk]]).trim() !== '') return obj[canon[kk]];
  }
  return '';
};
const pickNum = (obj, keys) => parseNumber(pick(obj, keys));

// ---------------- Convert handler (single overpayment sheet only) ----------------
const handleInvoiceOverpaymentConvert = (req, res) => {
  try {
    if (!fs.existsSync(uploadedInvoicePaymentPath) || !fs.existsSync(uploadedCoaPath)) {
      throw new Error('Missing one or more uploaded files');
    }

    const invRows = readFirstSheet(uploadedInvoicePaymentPath);
    const coaRows = readFirstSheet(uploadedCoaPath);

    // Build COA map: ID -> Name
    const coaMap = {};
    for (const r of coaRows) {
      const id = toStr(r['ID'] ?? r['Id'] ?? r['AccountId'] ?? r['Account ID']);
      const name = toStr(r['Name'] ?? r['AccountName'] ?? r['Account Name']);
      if (id) coaMap[id] = name || '';
    }

    // Header aliases
    const DOC_KEYS    = ['DocumentNumber','DocumentNo','Document Number','Receipt No','ReceiptNo','Payment No','PaymentNo','Invoice No','InvoiceNo','Txn No','Transaction No'];
    const DATE_KEYS   = ['Date','PaymentDate','ReceiptDate','Txn Date','Transaction Date','Created Date'];
    const UNAL_KEYS   = ['AmountDue','TotalUnallocated','Total Unallocated','Unallocated Amount','Unallocated','Balance','Outstanding','Amount Unallocated'];
    const CUST_KEYS   = ['CustomerName','Customer','Name','ContactName','Customer Name'];
    const BANKID_KEYS = ['BankAccountId','Bank Account Id','Bank Account ID','BankAccountID','DepositToAccountId','Deposit Account Id'];
    const REF_KEYS    = ['Reference','Reference No','Ref No','RefNo'];
    const MEMO_KEYS   = ['Description','Memo','Narration','Details'];
    const CUR_KEYS    = ['Currency Code','Currency','CurrencyCode'];
    const EXR_KEYS    = ['Exchange Rate','ExchangeRate','Rate'];

    if (!invRows.length) throw new Error('Invoice payment sheet is empty');

    // STEP 1: exact-zero removal (Excel-style: == 0)
    const rowsAfterZero = invRows
      .map(r => ({ r, unalloc: pickNum(r, UNAL_KEYS) }))
      .filter(x => Number(x.unalloc) !== 0)
      .map(x => x.r);

    // STEP 2: prepare workspace entries with docRaw and sortKey
    const workspacePrep = rowsAfterZero.map(r => {
      const docRaw = toStr(pick(r, DOC_KEYS));
      const sortKey = docRaw.toUpperCase().trim();
      const keyDoc = strongDocKey(docRaw);
      return { r, docRaw, sortKey, keyDoc };
    });

    // STEP 3: sort A->Z by sortKey (case-insensitive)
    workspacePrep.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' }));

    // STEP 4: Excel-style compare current with next (G2=G3). equalNext===true if same as next.
    for (let i = 0; i < workspacePrep.length; i++) {
      const curr = workspacePrep[i].sortKey || '';
      const next = (i < workspacePrep.length - 1) ? workspacePrep[i+1].sortKey || '' : '';
      workspacePrep[i].equalNext = (curr === next);
    }

    // STEP 5: select last-in-group rows => where equalNext === false
    const overpaymentRows = workspacePrep.filter(x => x.equalNext === false);

    // Build overpayment sheet with ONLY the 9 columns required
    const overpayment = overpaymentRows.map(x => {
      const r = x.r;
      const docNoRaw = toStr(pick(r, DOC_KEYS));
      const refNo = trim21(docNoRaw); // QBO limit 21 chars
      const bankIdVal = toStr(pick(r, BANKID_KEYS));
      const bankName = coaMap[bankIdVal] || 'Undeposited Funds';
      const amount = pickNum(r, UNAL_KEYS); // sign preserved
      return {
        'Ref No': refNo,
        'Payment Date': formatDate(pick(r, DATE_KEYS)),
        'Customer': toStr(pick(r, CUST_KEYS)),
        'Deposit To Account Name': bankName,
        'Amount': amount,
        'Reference No': toStr(pick(r, REF_KEYS)),
        'Memo': toStr(pick(r, MEMO_KEYS)),
        'Currency Code': toStr(pick(r, CUR_KEYS)),
        'Exchange Rate': toStr(pick(r, EXR_KEYS))
      };
    });

    // Save workbook with ONLY the overpayment sheet
    const outDir = join(__dirname, '..', 'converted');
    mkdirSync(outDir, { recursive: true });
    const outName = `converted_invoice_overpayment_${Date.now()}.xlsx`;
    const outPath = join(outDir, outName);

    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(overpayment), 'overpayment');
    writeFile(wb, outPath);

    // counts for response
    const FALSEcnt = workspacePrep.filter(x => !x.equalNext).length;

    console.log('✅ Invoice Overpayment converted (single overpayment sheet):', outPath);
    res.status(200).json({
      message: 'Conversion successful',
      path: outPath,
      counts: {
        input_rows: invRows.length,
        after_zero: rowsAfterZero.length,
        overpayment_rows: FALSEcnt
      }
    });
  } catch (e) {
    console.error('Conversion error:', e);
    res.status(500).json({ message: e.message });
  }
};

// ---------------- Download handler ----------------
const downloadInvoiceOverpayment = (req, res) => {
  try {
    const dir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('converted_invoice_overpayment_') && f.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(dir, b)).mtime - fs.statSync(join(dir, a)).mtime);
    if (!files.length) return res.status(404).json({ message: 'No converted file found' });
    const latest = files[0];
    res.download(join(dir, latest), latest);
  } catch (e) {
    console.error('Download error:', e);
    res.status(500).json({ message: 'Download failed' });
  }
};

export {
  uploadInvoiceOverpayment,
  handleInvoiceOverpaymentUpload,
  handleInvoiceOverpaymentConvert,
  downloadInvoiceOverpayment
};

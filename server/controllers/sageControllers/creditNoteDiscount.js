// server/controllers/sageControllers/creditNoteDiscount.js
import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let uploadedCreditPath = '';
let uploadedItemPath   = '';
let uploadedCoaPath    = '';
let uploadedTaxPath    = '';

/* ---------------- config ---------------- */
const FIXED_TAX_RATE_PERCENT = 15; // 15% as per your requirement

/* ---------------- helpers ---------------- */
function readSheet(filePath) {
  const wb = readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json(ws, { defval: '' });
  return rows.map((r, i) => {
    const o = {};
    for (const k of Object.keys(r)) o[String(k).trim()] = r[k];
    o.__rowIndex = i; // preserve order
    return o;
  });
}
function asNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v).trim();
  if (!s) return 0;
  const isParen = /^\(.*\)$/.test(s);
  s = s.replace(/[,\s]/g, '').replace(/[()]/g, '');
  let n = parseFloat(s);
  if (isNaN(n)) n = 0;
  return isParen ? -n : n;
}
function g(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}
const normStr = v => String(v ?? '').trim();
const normDoc = v => String(v ?? '').trim();
function normId(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  let s = String(v).trim();
  if (!s) return '';
  if (/^\d+(\.\d+)?$/.test(s)) return String(Math.trunc(Number(s)));
  return s.replace(/[^\d]/g, '') || s;
}
function parseSafeDate(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d;
}
function getLineType(row) {
  const v = g(row, 'LineType', 'LineTypeId', 'Line_Type', 'Line Type');
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
const isItemLine = row => getLineType(row) === 0;

/* ---------- robust getters (base + derived fallbacks) ---------- */
// Base (no derivation)
function getQtyBase(row){
  return asNumber(g(row,'Quantity','Line_Quantity','Qty','Line Qty','Line_Qty'));
}
function getRateBase(row){
  return asNumber(g(
    row,
    'Rate','UnitPrice','Unit Price','Unit_Price',
    'Line_Rate','Line Rate','Line_UnitPrice','Line Unit Price',
    'Price','UnitPriceExclTax','Unit Price Excl Tax',
    'UnitPriceInclTax','Unit Price Incl Tax'
  ));
}
function getAmountBase(row){
  return asNumber(g(
    row,
    // common
    'Amount','Line_Amount','Line Amount','LineTotal','Line Total','LineTotalAmount',
    // net/exclusive
    'NetAmount','Net Amount','Line_NetAmount','Line Net Amount',
    'Exclusive Amount','Excl Amount','Line Amount (Exclusive of Tax)',
    'LineAmountExclTax','Line Amount Excl Tax',
    // observed
    'Line Exclusive','Line_Exclusive','LineExclusive','Line Exclusive Amount','Exclusive Line Amount',
    // gross/inclusive
    'Gross Amount','Line_GrossAmount','Line Gross Amount','LineAmountInclTax','Line Amount Incl Tax',
    // sometimes Subtotal
    'Subtotal','Sub Total','Line_Subtotal','Line Subtotal'
  ));
}
function getDiscountValue(row){
  return asNumber(g(
    row,
    'Discount','Discount Amount','DiscountAmount',
    'Line_Discount','Line Discount','Line_DiscountAmount','Line Discount Amount',
    'Header Discount','Document Discount','Doc Discount','DiscAmount','Disc Amt'
  ));
}

// Derived with fallbacks
function getQty(row){
  const q = getQtyBase(row);
  return q || 1; // default 1
}
function getLineAmount(row){
  let amt = getAmountBase(row);
  if (!amt) {
    // derive from rate * qty
    const q = getQty(row);
    const r = getRateBase(row);
    if (q && r) amt = +(q * r).toFixed(4);
  }
  return amt;
}
function getRate(row){
  let r = getRateBase(row);
  if (!r) {
    // derive from amount / qty
    const q = getQty(row);
    const amt = getAmountBase(row);
    if (q && amt) r = +(amt / q).toFixed(4);
    else {
      const derivedAmt = getLineAmount(row);
      if (q && derivedAmt) r = +(derivedAmt / q).toFixed(4);
    }
  }
  return r;
}

/* ---------- fixed 15% tax helpers ---------- */
function calcTax(amount, decimals = 2) {
  if (!amount) return 0;
  const val = Math.abs(amount) * (FIXED_TAX_RATE_PERCENT / 100);
  const rounded = Number(val.toFixed(decimals));
  return amount < 0 ? -rounded : rounded;
}

/* ---------- build lookups ---------- */
function buildItemIndex(itemData) {
  const byId = new Map(), byCode = new Map(), byName = new Map();
  for (const r of itemData) {
    const id   = normId(g(r,'ID','Id','id'));
    const code = normStr(g(r,'Code','code'));
    const name = normStr(g(r,'Name','name'));
    if (id)   byId.set(id, r);
    if (code) byCode.set(code.toLowerCase(), r);
    if (name) byName.set(name.toLowerCase(), r);
  }
  return { byId, byCode, byName };
}
function buildCoaIndex(coaData) {
  const byId = new Map(), byCode = new Map(), byName = new Map();
  for (const r of coaData) {
    const id   = normId(g(r,'ID','Id','id'));
    const code = normStr(g(r,'Code','code'));
    const name = normStr(g(r,'Name','name'));
    if (id)   byId.set(id, r);
    if (code) byCode.set(code.toLowerCase(), r);
    if (name) byName.set(name.toLowerCase(), r);
  }
  return { byId, byCode, byName };
}

/* ---------- Upload Dir Setup ---------- */
const uploadDir = join('uploads', 'creditnotediscount');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${file.fieldname}_${Date.now()}${ext}`);
  }
});
const uploadCreditNoteDiscount = multer({ storage });

/* ---------- Upload Handler ---------- */
const handleCreditNoteDiscountUpload = (req, res) => {
  try {
    if (!req.files || !req.files.creditNote || !req.files.item || !req.files.coa || !req.files.tax) {
      return res.status(400).json({ message: 'All 4 files (creditNote, item, coa, tax) are required' });
    }
    uploadedCreditPath = req.files.creditNote[0].path;
    uploadedItemPath   = req.files.item[0].path;
    uploadedCoaPath    = req.files.coa[0].path;
    uploadedTaxPath    = req.files.tax[0].path;

    res.status(200).json({ message: 'Files uploaded successfully (credit note discount)' });
  } catch (err) {
    console.error('[cnd] Upload error:', err);
    res.status(500).json({ message: 'Upload failed (credit note discount)', error: err?.message || String(err) });
  }
};

/* ---------- display helpers ---------- */
function resolveMainProductDisplay(row, itemIdx, coaIdx) {
  const selId = normId(g(row,'Line_SelectionId','Line_SelectionID','SelectionId'));
  const preferItem = isItemLine(row);

  const itemById = selId ? itemIdx.byId.get(selId) : null;
  const coaById  = selId ? coaIdx.byId.get(selId)  : null;

  if (itemById && !coaById) return itemById.Code || itemById.Name || 'Unknown Item';
  if (coaById  && !itemById) return coaById.Name  || coaById.Code  || 'Unknown Account';
  if (itemById && coaById)   return preferItem
      ? (itemById.Code || itemById.Name || 'Unknown Item')
      : (coaById.Name  || coaById.Code  || 'Unknown Account');

  const selCode = normStr(g(row,'Line_SelectionCode','Line_ItemCode','Line_AccountCode','SelectionCode','AccountCode','ItemCode'));
  const selName = normStr(g(row,'Line_SelectionName','Line_ItemName','Line_AccountName','SelectionName','AccountName','ItemName'));

  if (preferItem) {
    const byCode = selCode && itemIdx.byCode.get(selCode.toLowerCase());
    const byName = !byCode && selName && itemIdx.byName.get(selName.toLowerCase());
    if (byCode || byName) return (byCode || byName).Code || (byCode || byName).Name || 'Unknown Item';

    const coaCode = selCode && coaIdx.byCode.get(selCode.toLowerCase());
    const coaName = !coaCode && selName && coaIdx.byName.get(selName.toLowerCase());
    if (coaCode || coaName) return (coaCode || coaName).Name || (coaCode || coaName).Code || 'Unknown Account';
  } else {
    const byCode = selCode && coaIdx.byCode.get(selCode.toLowerCase());
    const byName = !byCode && selName && coaIdx.byName.get(selName.toLowerCase());
    if (byCode || byName) return (byCode || byName).Name || (byCode || byName).Code || 'Unknown Account';

    const itCode = selCode && itemIdx.byCode.get(selCode.toLowerCase());
    const itName = !itCode && selName && itemIdx.byName.get(selName.toLowerCase());
    if (itCode || itName) return (itCode || itName).Code || (itCode || itName).Name || 'Unknown Item';
  }
  return preferItem ? 'Unknown Item' : 'Unknown Account';
}

function resolveDiscountProductDisplay(fullDoc, creditRows, itemIdx, coaIdx) {
  const docRows = creditRows.filter(r =>
    normDoc(g(r,'DocumentNumber','CreditNoteNumber','Credit Note Number')) === String(fullDoc)
  );
  const firstItemRow = docRows.find(isItemLine);
  const firstCoaRow  = docRows.find(r => !isItemLine(r));
  if (firstItemRow) return resolveMainProductDisplay(firstItemRow, itemIdx, coaIdx);
  if (firstCoaRow)  return resolveMainProductDisplay(firstCoaRow, itemIdx, coaIdx);
  return 'Unknown Account';
}

/* =========================
   CONVERT
   ========================= */
const convertCreditNoteDiscount = () => {
  if (
    !fs.existsSync(uploadedCreditPath) ||
    !fs.existsSync(uploadedItemPath) ||
    !fs.existsSync(uploadedCoaPath) ||
    !fs.existsSync(uploadedTaxPath)
  ) {
    throw new Error('[cnd] Missing one or more uploaded files');
  }

  const creditData = readSheet(uploadedCreditPath);
  const itemData   = readSheet(uploadedItemPath);
  const coaData    = readSheet(uploadedCoaPath);
  const taxData    = readSheet(uploadedTaxPath); // kept for future but not used for rate now

  const itemIdx = buildItemIndex(itemData);
  const coaIdx  = buildCoaIndex(coaData);

  // sort by DocumentNumber then keep original order
  const sorted = [...creditData].sort((a,b) => {
    const da = String(g(a,'DocumentNumber','CreditNoteNumber','Credit Note Number') || '');
    const db = String(g(b,'DocumentNumber','CreditNoteNumber','Credit Note Number') || '');
    const byDoc = da.localeCompare(db, undefined, { numeric: true, sensitivity: 'base' });
    if (byDoc !== 0) return byDoc;
    return (a.__rowIndex ?? 0) - (b.__rowIndex ?? 0);
  });

  // group by document
  const groups = new Map();
  for (const r of sorted) {
    const doc = normDoc(g(r,'DocumentNumber','CreditNoteNumber','Credit Note Number'));
    if (!doc) continue;
    if (!groups.has(doc)) groups.set(doc, []);
    groups.get(doc).push(r);
  }

  const finalRows = [];

  for (const [doc, rows] of groups.entries()) {
    // document-level discount presence
    let headerDiscount = 0;
    for (const r of rows) {
      const d = getDiscountValue(r);
      if (d !== 0) { headerDiscount = d; break; }
    }
    if (headerDiscount === 0) continue; // process only docs with discount

    // 1) all original rows AS-IS (with derived fallbacks)
    for (const src of rows) {
      const amt = getLineAmount(src);
      const taxAmt = amt ? calcTax(amt, 2) : 0; // 2 decimals for originals

      finalRows.push({
        'Credit No': String(doc).slice(0, 21),
        'Customer': g(src,'CustomerName') || '',
        'Credit Date': parseSafeDate(g(src,'Date','CreditDate')),
        'Global Tax Calculation': 'TaxExcluded',
        'Product/Service': resolveMainProductDisplay(src, itemIdx, coaIdx),
        'Product/Service Description': g(src,'Description') || '',
        'Product/Service Quantity': getQty(src),
        'Product/Service Rate': getRate(src),
        'Product/Service Amount': amt,
        'Product/Service Tax Code': 'Standard', // display as in your sheet
        'Product/Service Tax Amount': taxAmt,
        'Product/Service Class': '',
        'Currency Code': g(src,'Currency') || '',
        'Exchange Rate': g(src,'Exchange rate','Exchange Rate') || '',
        'Discount Percent': g(src,'DiscountPercentage') || '',
        'Memo on statement': g(src,'Message') || ''
      });
    }

    // 2) single discount line at end
    const productDisplay = resolveDiscountProductDisplay(doc, creditData, itemIdx, coaIdx);
    const discountAbs = Math.abs(headerDiscount);
    const rateVal   = +discountAbs.toFixed(2);
    const amountVal = -rateVal;
    const taxAmount = calcTax(amountVal, 3); // 3 decimals for discount line (like your screenshot)

    finalRows.push({
      'Credit No': String(doc).slice(0, 21),
      'Customer': g(rows[0],'CustomerName') || '',
      'Credit Date': parseSafeDate(g(rows[0],'Date','CreditDate')),
      'Global Tax Calculation': 'TaxExcluded',
      'Product/Service': productDisplay,
      'Product/Service Description': 'Credit Note Discount',
      'Product/Service Quantity': 1,
      'Product/Service Rate': -rateVal,
      'Product/Service Amount': amountVal,
      'Product/Service Tax Code': 'Standard',
      'Product/Service Tax Amount': taxAmount, // negative 15%
      'Product/Service Class': '',
      'Currency Code': g(rows[0],'Currency') || '',
      'Exchange Rate': g(rows[0],'Exchange rate','Exchange Rate') || '',
      'Discount Percent': g(rows[0],'DiscountPercentage') || '',
      'Memo on statement': g(rows[0],'Message') || ''
    });
  }

  // Excel
  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'creditnotediscountline_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);

  const wb = utils.book_new();
  const ws = utils.json_to_sheet(finalRows);
  utils.book_append_sheet(wb, ws, 'creditnotediscountline');
  writeFile(wb, outputPath);

  console.log('✅ [cnd] creditnotediscountline ready:', outputPath);
  return outputPath;
};

/* -------- API handlers -------- */
const handleCreditNoteDiscountConvert = (_req, res) => {
  try {
    const outputPath = convertCreditNoteDiscount();
    res.status(200).json({ message: 'Credit Note Discount conversion successful', path: outputPath });
  } catch (err) {
    console.error('[cnd] Conversion error:', err);
    res.status(500).json({ message: err.message });
  }
};

const downloadCreditNoteDiscount = (_req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('creditnotediscountline_') && file.endsWith('.xlsx'))
      .sort((a, b) =>
        fs.statSync(join(convertedDir, b)).mtimeMs -
        fs.statSync(join(convertedDir, a)).mtimeMs
      );
    if (!files.length) return res.status(404).json({ message: 'No creditnotediscountline file found' });
    const latest = files[0];
    return res.download(join(convertedDir, latest), latest);
  } catch (err) {
    try {
      const convertedDir = join(__dirname, '..', 'converted');
      const files = fs.readdirSync(convertedDir)
        .filter(f => f.startsWith('creditnotediscountline_') && f.endsWith('.xlsx'))
        .map(f => ({ f, t: fs.statSync(join(convertedDir, f)).mtimeMs }))
        .sort((a,b) => b.t - a.t);
      if (!files.length) return res.status(404).json({ message: 'No creditnotediscountline file found' });
      const latest = files[0].f;
      return res.download(join(convertedDir, latest), latest);
    } catch (e2) {
      console.error('[cnd] Download error:', e2);
      return res.status(500).json({ message: 'Download failed (credit note discount)' });
    }
  }
};

export {
  uploadCreditNoteDiscount,
  handleCreditNoteDiscountUpload,
  handleCreditNoteDiscountConvert,
  downloadCreditNoteDiscount
};

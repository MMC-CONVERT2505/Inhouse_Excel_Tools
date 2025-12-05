// server/controllers/sageControllers/invoiceDiscount.js
import fs, { mkdirSync } from 'fs';
import path, { join, extname } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { utils, writeFile, readFile } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let uploadedInvoicePath = '';
let uploadedItemPath    = '';
let uploadedCoaPath     = '';
let uploadedTaxPath     = '';

/* ---------------- helpers ---------------- */
function readSheet(filePath) {
  const wb = readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json(ws, { defval: '' });
  return rows.map(r => {
    const o = {};
    for (const k of Object.keys(r)) o[String(k).trim()] = r[k];
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
function g(obj, ...keys) {               // safe getter
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}
function normStr(v) { return String(v ?? '').trim(); }
function normId(v) {                      // robust: 9606964.0 -> 9606964, trims, digits-only
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  let s = String(v).trim();
  if (!s) return '';
  if (/^\d+(\.\d+)?$/.test(s)) return String(Math.trunc(Number(s)));
  return s.replace(/[^\d]/g, '') || s;
}
function getLineType(row) {               // support LineType / LineTypeId
  const v = g(row, 'LineType', 'LineTypeId', 'Line_Type', 'Line Type');
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function isItemLine(row) { return getLineType(row) === 0; }

/* ---------- small new helpers ---------- */
function normDoc(v) { return String(v ?? '').trim(); }
function parseSafeDate(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d;
}

/* ---------- build fast lookup indexes ---------- */
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
const uploadDir = join('uploads', 'invoicediscount');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${file.fieldname}_${Date.now()}${ext}`);
  }
});
const uploadInvoiceDiscount = multer({ storage });

/* ---------- Upload Handler (fields: invoicePayment, item, coa, tax) ---------- */
const handleInvoiceDiscountUpload = (req, res) => {
  try {
    if (
      !req.files || !req.files.invoicePayment ||
      !req.files.item || !req.files.coa || !req.files.tax
    ) {
      return res.status(400).json({ message: 'All 4 files (invoice, item, coa, tax) are required' });
    }
    uploadedInvoicePath = req.files.invoicePayment[0].path;
    uploadedItemPath    = req.files.item[0].path;
    uploadedCoaPath     = req.files.coa[0].path;
    uploadedTaxPath     = req.files.tax[0].path;

    console.log('✅ [disc] Invoice path:', uploadedInvoicePath);
    console.log('✅ [disc] Item path   :', uploadedItemPath);
    console.log('✅ [disc] COA path    :', uploadedCoaPath);
    console.log('✅ [disc] Tax path    :', uploadedTaxPath);

    res.status(200).json({ message: 'Files uploaded successfully (discount)' });
  } catch (err) {
    console.error('[disc] Upload error:', err);
    res.status(500).json({ message: 'Upload failed (discount)' });
  }
};

/* =========================
   LOGIC
   ========================= */

function filterDiscountRows(invoiceRows) {
  return invoiceRows.filter(r => asNumber(g(r,'Discount')) !== 0);
}
function sortByDocumentNumber(rows) {
  return [...rows].sort((a, b) =>
    String(g(a,'DocumentNumber') || '').localeCompare(
      String(g(b,'DocumentNumber') || ''), undefined, { numeric: true, sensitivity: 'base' }
    )
  );
}
function pickLastRowPerDocumentNumber(sortedRows) {
  const lastByDoc = new Map();
  for (const r of sortedRows) {
    const doc = String(g(r,'DocumentNumber') || '').trim();
    if (!doc) continue;
    lastByDoc.set(doc, r);
  }
  return Array.from(lastByDoc.values());
}
function pickTaxCodeForInvoice(fullDoc, invoiceRows, taxData) {
  const base = invoiceRows.find(r =>
    String(g(r,'DocumentNumber') || '') === String(fullDoc) &&
    g(r,'Line_TaxTypeId','Line_TaxTypeID')
  );
  if (!base) return 'Out of Scope';
  const taxMatch = taxData.find(
    t => String(g(t,'ID','Id','id')) === String(g(base,'Line_TaxTypeId','Line_TaxTypeID'))
  );
  const name = (g(taxMatch,'Name','name') || 'Out of Scope').replace(/\bRate\b/gi, '').trim();
  return name || 'Out of Scope';
}

/* ---------- Dual lookup: SelectionId → (Item & COA), then prefer by LineType ---------- */
function resolveMainProductDisplay(row, itemIdx, coaIdx) {
  const selId = normId(g(row,'Line_SelectionId','Line_SelectionID','SelectionId'));
  const preferItem = isItemLine(row); // preference only if ID both sides exist

  // 1) try ID in both masters
  const itemById = selId ? itemIdx.byId.get(selId) : null;
  const coaById  = selId ? coaIdx.byId.get(selId)  : null;

  if (itemById && !coaById) return itemById.Code || itemById.Name || 'Unknown Item';
  if (coaById  && !itemById) return coaById.Name  || coaById.Code  || 'Unknown Account';
  if (itemById && coaById)   return preferItem
      ? (itemById.Code || itemById.Name || 'Unknown Item')
      : (coaById.Name  || coaById.Code  || 'Unknown Account');

  // 2) fallbacks by code/name (defensive)
  const selCode = normStr(
    g(row,'Line_SelectionCode','Line_ItemCode','Line_AccountCode','SelectionCode','AccountCode','ItemCode')
  );
  const selName = normStr(
    g(row,'Line_SelectionName','Line_ItemName','Line_AccountName','SelectionName','AccountName','ItemName')
  );

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

  // 3) last resort
  return preferItem ? 'Unknown Item' : 'Unknown Account';
}

/* Discount line Product/Service (display) */
function resolveDiscountProductDisplay(fullDoc, invoiceRows, itemIdx, coaIdx) {
  const docRows = invoiceRows.filter(r => String(g(r,'DocumentNumber') || '') === String(fullDoc));
  const firstItemRow = docRows.find(isItemLine);
  const firstCoaRow  = docRows.find(r => !isItemLine(r));

  // try "discount" in masters first
  const findDiscountDisplay = (idx, prefer='item') => {
    for (const m of idx.byName.values()) {
      const code = normStr(g(m,'Code','code')).toLowerCase();
      const name = normStr(g(m,'Name','name')).toLowerCase();
      if (code === 'discount' || name === 'discount' || code.includes('discount') || name.includes('discount')) {
        return prefer === 'item' ? (g(m,'Code','code') || g(m,'Name','name'))
                                 : (g(m,'Name','name') || g(m,'Code','code'));
      }
    }
    for (const m of idx.byCode.values()) {
      const code = normStr(g(m,'Code','code')).toLowerCase();
      const name = normStr(g(m,'Name','name')).toLowerCase();
      if (code === 'discount' || name === 'discount' || code.includes('discount') || name.includes('discount')) {
        return prefer === 'item' ? (g(m,'Code','code') || g(m,'Name','name'))
                                 : (g(m,'Name','name') || g(m,'Code','code'));
      }
    }
    return '';
  };

  if (firstItemRow) {
    const hit = findDiscountDisplay(itemIdx,'item');
    if (hit) return hit;
    return resolveMainProductDisplay(firstItemRow, itemIdx, coaIdx); // strict ID join fallback
  } else if (firstCoaRow) {
    const hit = findDiscountDisplay(coaIdx,'coa');
    if (hit) return hit;
    return resolveMainProductDisplay(firstCoaRow, itemIdx, coaIdx);  // strict ID join fallback
  }
  return 'Unknown Account';
}

/* Build discount line */
function buildDiscountLineRow(discountSrcRow, invoiceRows, taxData, itemIdx, coaIdx) {
  const fullDoc  = String(g(discountSrcRow,'DocumentNumber') || '').trim();
  const docNoOut = fullDoc.slice(0, 21);
  const base     = invoiceRows.find(r => String(g(r,'DocumentNumber') || '').trim() === fullDoc);

  const discountAbs = Math.abs(asNumber(g(discountSrcRow,'Discount')) || 0);
  const negVal      = -+(discountAbs.toFixed(2));

  const productDisplay = String(resolveDiscountProductDisplay(fullDoc, invoiceRows, itemIdx, coaIdx));
  const taxCode = pickTaxCodeForInvoice(fullDoc, invoiceRows, taxData) || 'Out of Scope';

  // ** APPLY 15% TAX ON DISCOUNT AMOUNT **
  // discountAbs is positive absolute amount (e.g. 170)
  // taxAmount should be negative: -(discountAbs * 15%)
  const taxAmount = discountAbs === 0 ? 0 : - +((discountAbs * 0.15).toFixed(2));

  return {
    'Invoice No': docNoOut,
    'Customer': g(base,'CustomerName') || g(discountSrcRow,'CustomerName') || '',
    'Invoice Date': parseSafeDate(g(base,'Date') || g(discountSrcRow,'Date')),
    'Due Date': parseSafeDate(g(base,'DueDate') || g(discountSrcRow,'DueDate')),
    'Global Tax Calculation': 'TaxExcluded',
    'Product/Service': productDisplay,
    'Product/Service Description': 'Invoice Discount',
    'Product/Service Quantity': 1,
    'Product/Service Rate': negVal,
    'Product/Service Amount': negVal,
    'Product/Service Tax Code': taxCode,
    'Product/Service Tax Amount': taxAmount,
    'Product/Service Class': '',
    'Currency Code': g(base,'Currency') || g(discountSrcRow,'Currency') || '',
    'Exchange Rate': g(base,'Exchange rate','Exchange Rate') || g(discountSrcRow,'Exchange rate','Exchange Rate') || '',
    'Discount Percent': g(base,'DiscountPercentage') || g(discountSrcRow,'DiscountPercentage') || '',
    'Memo on statement': g(base,'Message') || g(discountSrcRow,'Message') || ''
  };
}

/* =========================
   CONVERT (main + discount)
   ========================= */
const convertInvoiceDiscount = () => {
  if (
    !fs.existsSync(uploadedInvoicePath) ||
    !fs.existsSync(uploadedItemPath) ||
    !fs.existsSync(uploadedCoaPath) ||
    !fs.existsSync(uploadedTaxPath)
  ) {
    throw new Error('[discount] Missing one or more uploaded files');
  }

  const invoiceData = readSheet(uploadedInvoicePath);
  const itemData    = readSheet(uploadedItemPath);
  const coaData     = readSheet(uploadedCoaPath);
  const taxData     = readSheet(uploadedTaxPath);

  // ---------- CLEAN invoiceData: remove blank-document rows and pure-zero lines ----------
const cleanedInvoiceData = invoiceData.filter(row => {
  const doc = normDoc(g(row, 'DocumentNumber', 'Invoice No'));
  if (!doc) return false; // skip rows without DocumentNumber

  // important numeric fields
  const numExclusive = asNumber(g(row, 'Line_Exclusive', 'Line Exclusive', 'Line_Amount', 'Product/Service Amount'));
  const numQty       = asNumber(g(row, 'Line_Quantity', 'Product/Service Quantity', 'Quantity'));
  const numUnitPrice = asNumber(g(row, 'Line_UnitPriceExclusive', 'Product/Service Rate', 'Line UnitPriceExclusive', 'Line_UnitPrice'));
  const numTax       = asNumber(g(row, 'Line_Tax', 'Product/Service Tax Amount', 'TaxAmount', 'Line_TaxAmount'));
  const numDiscount  = asNumber(g(row, 'Discount', 'DiscountPercentage'));

  // 👉 New rule: agar DiscountPercentage == 0 → skip
  if (numDiscount === 0) return false;

  const allZero = (numExclusive === 0 && numQty === 0 && numUnitPrice === 0 && numTax === 0);
  return !allZero;
});


  console.log('[disc] Raw invoice rows:', invoiceData.length);
  console.log('[disc] Cleaned invoice rows:', cleanedInvoiceData.length);

  const itemIdx = buildItemIndex(itemData);
  const coaIdx  = buildCoaIndex(coaData);

  // ---- group main invoice lines per doc (use cleanedInvoiceData)
  const groups = new Map();
  const docOrder = [];

  cleanedInvoiceData.forEach(row => {
    const doc = normDoc(g(row,'DocumentNumber'));
    if (!doc) return; // safety

    if (!groups.has(doc)) {
      groups.set(doc, { order: docOrder.length, lines: [], anyRow: row });
      docOrder.push(doc);
    }
    const gdoc = groups.get(doc);

    const quantity = g(row,'Line_Quantity') || 1;
    const rate     = g(row,'Line_UnitPriceExclusive') || 0;
    const taxAmt   = g(row,'Line_Tax') || 0;

    const product  = resolveMainProductDisplay(row, itemIdx, coaIdx);

    const taxMatch = taxData.find(t => String(g(t,'ID','Id','id')) === String(g(row,'Line_TaxTypeId','Line_TaxTypeID')));
    let taxCode = taxMatch ? g(taxMatch,'Name','name') : 'Out of Scope';
    taxCode = (taxCode || 'Out of Scope').replace(/\bRate\b/gi, '').trim();

    gdoc.lines.push({
      'Invoice No': doc.slice(0, 21),
      'Customer': g(row,'CustomerName'),
      'Invoice Date': parseSafeDate(g(row,'Date')),
      'Due Date': parseSafeDate(g(row,'DueDate')),
      'Global Tax Calculation': 'TaxExcluded',
      'Product/Service': product, // Item⇒Code, COA⇒Name
      'Product/Service Description': g(row,'Line_Description'),
      'Product/Service Quantity': quantity,
      'Product/Service Rate': rate,
      'Product/Service Amount': g(row,'Line_Exclusive'),
      'Product/Service Tax Code': taxCode,
      'Product/Service Tax Amount': taxAmt,
      'Product/Service Class': '',
      'Currency Code': g(row,'Currency'),
      'Exchange Rate': g(row,'Exchange rate','Exchange Rate'),
      'Discount Percent': g(row,'DiscountPercentage'),
      'Memo on statement': g(row,'Message')
    });
  });

  const distinctDocs = Array.from(groups.keys()).length;
  console.log('[disc] Distinct documents after clean:', distinctDocs);

  // ---- discount source: Discount != 0 → sort → LAST per doc (use cleanedInvoiceData)
  const discountCandidates = cleanedInvoiceData.filter(r => asNumber(g(r,'Discount')) !== 0);
  console.log('[disc] Discount candidates (non-zero):', discountCandidates.length);

  const sortedByDoc        = sortByDocumentNumber(discountCandidates);
  const lastPerDoc         = pickLastRowPerDocumentNumber(sortedByDoc);
  console.log('[disc] LastPerDoc (discount to apply):', lastPerDoc.length);

  const discountMap        = new Map(lastPerDoc.map(r => [normDoc(g(r,'DocumentNumber')), r]));

  // ---- final assembly: main lines then discount line
  const finalRows = [];
  for (const doc of docOrder) {
    const gdoc = groups.get(doc);
    if (!gdoc) continue;

    for (const line of gdoc.lines) finalRows.push(line);

    const dRow = discountMap.get(doc);
    if (dRow) {
      const discLine = buildDiscountLineRow(dRow, cleanedInvoiceData, taxData, itemIdx, coaIdx);
      if (discLine['Product/Service Amount'] !== 0) finalRows.push(discLine);
    }
  }

  console.log('[disc] Final rows to write:', finalRows.length);

  // ---- write output
  const outputDir = join(__dirname, '..', 'converted');
  mkdirSync(outputDir, { recursive: true });

  const outputFileName = 'converted_invoicediscount_' + Date.now() + '.xlsx';
  const outputPath = join(outputDir, outputFileName);

  const newWb = utils.book_new();
  const newWs = utils.json_to_sheet(finalRows);
  utils.book_append_sheet(newWb, newWs, 'Invoices');
  writeFile(newWb, outputPath);

  console.log('✅ [disc] Invoice Discount converted:', outputPath);
  return outputPath;
};

/* -------- API handlers -------- */
const handleInvoiceDiscountConvert = (req, res) => {
  try {
    const outputPath = convertInvoiceDiscount();
    res.status(200).json({ message: 'Discount conversion successful', path: outputPath });
  } catch (err) {
    console.error('[disc] Conversion error:', err);
    res.status(500).json({ message: err.message });
  }
};

const downloadInvoiceDiscount = (req, res) => {
  try {
    const convertedDir = join(__dirname, '..', 'converted');
    const files = fs.readdirSync(convertedDir)
      .filter(file => file.startsWith('converted_invoicediscount_') && file.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(join(convertedDir, b)).mtimeMs - fs.statSync(join(convertedDir, a)).mtimeMs);

    if (files.length === 0) {
      return res.status(404).json({ message: 'No discount converted file found' });
    }

    const latestFile = files[0];
    const filePath = join(convertedDir, latestFile);
    res.download(filePath, latestFile);
  } catch (err) {
    console.error('[disc] Download error:', err);
    res.status(500).json({ message: 'Download failed (discount)' });
  }
};

export {
  uploadInvoiceDiscount,
  handleInvoiceDiscountUpload,
  handleInvoiceDiscountConvert,
  downloadInvoiceDiscount
};

// transferHandlers.js
import fs, { mkdirSync } from "fs";
import path, { join, extname } from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname } from "path";
import xlsx from "xlsx";

const { utils, readFile, writeFile, SSF } = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ====== FOLDERS ======
const transferUploadDir = join("uploads", "transfer");
mkdirSync(transferUploadDir, { recursive: true });

const convertedDir = join(__dirname, "..", "converted");
mkdirSync(convertedDir, { recursive: true });

// ====== STATE ======
let uploadedTransferPath = "";

// ====== MULTER (upload only transfer) ======
const transferStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, transferUploadDir),
  filename: (_req, file, cb) =>
    cb(null, "transfer_" + Date.now() + extname(file.originalname)),
});
const uploadTransfer = multer({ storage: transferStorage });

// ====== HELPERS ======
function toNum(val) {
  try {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "string") val = val.replace(/,/g, "");
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

// Excel serial date / string → JS Date
function parseExcelDate(dateVal) {
  if (dateVal === null || dateVal === undefined || dateVal === "") return null;

  if (dateVal instanceof Date) return dateVal;

  if (typeof dateVal === "number") {
    // 1900 origin with Excel's leap bug compatibility
    const parsed = SSF.parse_date_code(dateVal);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  if (typeof dateVal === "string") {
    // try dd/mm/yyyy and general Date parsing
    const d1 = new Date(dateVal);
    if (!isNaN(d1)) return d1;
    const m = dateVal.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10) - 1;
      let yy = parseInt(m[3], 10);
      if (yy < 100) yy += 2000;
      const d2 = new Date(yy, mm, dd);
      if (!isNaN(d2)) return d2;
    }
  }

  return null;
}

// small keyword matcher for flexible headers
function pickColumn(df, keywords, { exclude = [] } = {}) {
  const cols = Object.keys(df[0] || {});
  const low = cols.map((c) => c.toLowerCase());
  for (let i = 0; i < cols.length; i++) {
    const name = low[i];
    if (keywords.every((k) => name.includes(k.toLowerCase())) &&
        exclude.every((ex) => !name.includes(ex.toLowerCase()))) {
      return cols[i];
    }
  }
  return null;
}

// ====== UPLOAD HANDLER ======
const handleTransferUpload = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    uploadedTransferPath = req.file.path;
    console.log("[Transfer] uploaded:", uploadedTransferPath);
    res.status(200).json({ message: "File uploaded successfully" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
};

// ====== CONVERT (only 'transfer out') ======
// Output headers: From Bank | Date | To Bank | Reference | Amount
const convertTransfer = () => {
  if (!uploadedTransferPath || !fs.existsSync(uploadedTransferPath)) {
    throw new Error("No uploaded transfer file found");
  }

  // read first sheet
  const wb = readFile(uploadedTransferPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  let rows = utils.sheet_to_json(sheet, { defval: "" });

  if (!rows.length) {
    throw new Error("Uploaded file has no rows to process");
  }

  // detect columns (handles slight name changes)
  const colTransactionType = pickColumn(rows, ["transaction", "type"]) || "Transaction Type";
  const colDate           = pickColumn(rows, ["account", "date"]) || pickColumn(rows, ["date"]) || "Account Date";
  const colFromBank       = pickColumn(rows, ["account", "description"]) || "Account Description";
  const colToBank         = pickColumn(rows, ["bank"]) || pickColumn(rows, ["customer"]) || pickColumn(rows, ["supplier"]) || "Bank / Customer / Supplier";
  const colReference      = pickColumn(rows, ["reference"]) || "Reference";
  const colCredit         = pickColumn(rows, ["credit"]) || "Credit";

  // sanity check
  const required = [colTransactionType, colDate, colFromBank, colToBank, colReference, colCredit];
  if (required.some((c) => !c || !(c in rows[0]))) {
    throw new Error("Required columns not found. Expecting headers like: 'Account Description', 'Account Date', 'Bank / Customer / Supplier', 'Reference', 'Transaction Type', 'Credit'.");
  }

  // filter only 'transfer out'
  const filtered = rows.filter((r) => String(r[colTransactionType]).trim().toLowerCase() === "transfer out");

  // build output rows
  const outRows = filtered.map((r) => {
    const dt = parseExcelDate(r[colDate]);
    // final date text: dd/mm/yyyy (Excel date type set later)
    const dateVal = dt || "";

    return {
      "From Bank": r[colFromBank] ?? "",
      "Date": dateVal,
      "To Bank": r[colToBank] ?? "",
      "Reference": r[colReference] ?? "",
      "Amount": toNum(r[colCredit])  // CREDIT ONLY
    };
  });

  // ensure at least header row
  const safe = outRows.length
    ? outRows
    : [{ "From Bank": "", "Date": "", "To Bank": "", "Reference": "", "Amount": "" }];

  // write new workbook
  const outWb = utils.book_new();
  const ws = utils.json_to_sheet(safe);

  // make 'Date' column proper date format in Excel (column B)
  const rowsCount = safe.length + 1; // + header
  for (let r = 2; r <= rowsCount; r++) {
    const cell = ws[`B${r}`];
    if (cell && cell.v) {
      const d = parseExcelDate(cell.v);
      if (d) {
        cell.v = d;
        cell.t = "d";
        cell.z = "dd/mm/yyyy";
      }
    }
  }

  utils.book_append_sheet(outWb, ws, "Transfer Out");

  const outputFile = "converted_transfer_" + Date.now() + ".xlsx";
  const outputPath = join(convertedDir, outputFile);
  writeFile(outWb, outputPath);

  return outputPath;
};

// ====== CONVERT HANDLER ======
const handleTransferConvert = (_req, res) => {
  try {
    const path = convertTransfer();
    res.status(200).json({ message: "Transfer converted", path });
  } catch (err) {
    console.error("Conversion failed:", err);
    res.status(500).json({ message: err.message });
  }
};

// ====== DOWNLOAD LATEST ======
const downloadTransfer = (_req, res) => {
  try {
    const files = fs
      .readdirSync(convertedDir)
      .filter((f) => f.startsWith("converted_transfer_") && f.endsWith(".xlsx"))
      .sort(
        (a, b) =>
          fs.statSync(join(convertedDir, b)).mtime -
          fs.statSync(join(convertedDir, a)).mtime
      );

    if (files.length === 0) {
      return res.status(404).json({ message: "No converted transfer file found" });
    }
    const latest = files[0];
    const filePath = join(convertedDir, latest);
    res.download(filePath, latest);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ message: "Download failed" });
  }
};

// transferHandlers.js ke end me:
export {
  uploadTransfer as upload,           // ⬅️ rename export
  handleTransferUpload,
  handleTransferConvert,
  downloadTransfer
};

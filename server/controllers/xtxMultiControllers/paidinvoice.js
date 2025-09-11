import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { parse } from 'json2csv';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData2 = [];

const allowedColumn = [
  'ContactName', 'InvoiceNumber', 'Reference', 'InvoiceDate', 'DueDate', 'Total',
  'InventoryItemCode', 'Description', 'Quantity', 'UnitAmount', 'LineAmount', 'Discount', 'AccountCode',
  'TaxType', 'TaxAmount', 'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2', 'Currency',
  'CurrencyRate', 'Status', 'LineAmountType', 'InvoiceID'
];

const taxTypeMapping = {
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
};

function extractBeforeDash(str) {
  if (!str) return '';
  const idx = str.indexOf('-');
  return idx === -1 ? str : str.substring(0, idx);
}

function normalize(str) {
  return str ? str.toString().trim().toLowerCase() : '';
}

function formatDateToDDMMYYYY(dateStr) {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj)) return '';
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const paidinvoiceHandlerMulti = (req, res) => {
  uploadedData2 = [];

  if (!req.files || !req.files.file || !req.files.file2) {
    return res.status(400).json({ message: 'Both Excel files must be uploaded.' });
  }

  try {
    const file1Path = req.files.file[0].path;
    const file2Path = req.files.file2[0].path;

    const wb1 = xlsx.readFile(file1Path);
    const wb2 = xlsx.readFile(file2Path);

    const invoiceNoSheetName = 'invoice no';
    const paidInvoiceSheetName = 'PAID_Invoice';

    if (!wb1.SheetNames.includes(invoiceNoSheetName)) {
      return res.status(400).json({ message: `"${invoiceNoSheetName}" sheet not found in first file.` });
    }
    if (!wb2.SheetNames.includes(paidInvoiceSheetName)) {
      return res.status(400).json({ message: `"${paidInvoiceSheetName}" sheet not found in second file.` });
    }

    const dataInvoiceNo = xlsx.utils.sheet_to_json(wb1.Sheets[invoiceNoSheetName], { defval: '' });
    const dataPaidInvoice = xlsx.utils.sheet_to_json(wb2.Sheets[paidInvoiceSheetName], { defval: '' });

    unlinkSync(file1Path);
    unlinkSync(file2Path);

    if (dataInvoiceNo.length === 0 || dataPaidInvoice.length === 0) {
      return res.status(400).json({ message: 'One or both sheets are empty.' });
    }

    const invoiceCount = {};
    dataInvoiceNo.forEach(row => {
      const raw = row['InvoiceNumber'] || row['Invoice Number'] || '';
      const norm = normalize(raw);
      if (norm) invoiceCount[norm] = (invoiceCount[norm] || 0) + 1;
    });

    const duplicatesInInvoiceNo = new Set(
      Object.entries(invoiceCount)
        .filter(([_, count]) => count > 1)
        .map(([inv]) => inv)
    );

    const updatedpaidInvoice = dataPaidInvoice.map(row => {
      let invRaw = String(row['InvoiceNumber'] || '').trim();
      const invoiceID = String(row['InvoiceID'] || '').trim();
      const prefix = extractBeforeDash(invoiceID);

      if (!invRaw) {
        if (prefix) {
          row['InvoiceNumber'] = prefix;
        }
      } else {
        const invNoPrefix = invRaw.includes('_') ? invRaw.split('_').slice(1).join('_') : invRaw;
        const normInvNoPrefix = normalize(invNoPrefix);
        if (
          duplicatesInInvoiceNo.has(normInvNoPrefix) &&
          prefix &&
          !invRaw.startsWith(prefix + '_')
        ) {
          row['InvoiceNumber'] = `${prefix}_${invNoPrefix}`;
        }
      }

      ['InvoiceDate', 'DueDate'].forEach(col => {
        if (row[col]) row[col] = formatDateToDDMMYYYY(row[col]);
      });

      if (!row['Description']?.toString().trim()) row['Description'] = '.';
      if (!row['Quantity']?.toString().trim()) row['Quantity'] = 1;
      
      let rawTax = (row['TaxType'] || '').toString().trim().toUpperCase();
      row['TaxType'] = taxTypeMapping[rawTax] || 'BAS Excluded';


      row['Status'] = 'DRAFT';
      row['LineAmountType'] = 'Exclusive';

      return row;
    });

    uploadedData2 = updatedpaidInvoice;
    res.json({ message: 'Files uploaded and processed successfully.' });

  } catch (error) {
    console.error('Error in paidinvoiceHandler:', error);
    res.status(500).json({ message: `Failed to process files: ${error.message}` });
  }
};

const paidinvoiceConvertMulti = (req, res) => {
  if (!uploadedData2.length) {
    return res.status(400).json({ message: 'No uploaded data to convert.' });
  }
  try {
    const csvString = parse(uploadedData2, { fields: allowedColumn });

    const outputDir = join(__dirname, '../converted');
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    const outputPath = join(outputDir, 'converted.csv');
    writeFileSync(outputPath, csvString);

    res.json({ message: 'Excel converted to CSV successfully.' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Conversion failed.' });
  }
};

const paidinvoiceDownloadMulti = (req, res) => {
  const filePath = join(__dirname, '../converted/converted.csv');
  if (existsSync(filePath)) {
    res.download(filePath, 'converted.csv', err => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ message: 'Error during file download.' });
      }
    });
  } else {
    res.status(404).json({ message: 'Converted file not found.' });
  }
};

export {
  paidinvoiceHandlerMulti,
  paidinvoiceConvertMulti,
  paidinvoiceDownloadMulti,
};

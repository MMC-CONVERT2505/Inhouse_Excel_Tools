import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'json2csv';
import xlsx from 'xlsx'; // ✅ Correct way to import xlsx for CommonJS module

let uploadedData2 = [];

const allowedColumn = [
  'ContactName', 'InvoiceNumber', 'Reference', 'InvoiceDate', 'Total',
  'InventoryItemCode', 'Description', 'Quantity', 'UnitAmount', 'LineAmount', 'AccountCode',
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


// Helper to extract prefix before dash
function extractBeforeDash(str) {
  if (!str) return '';
  const idx = str.indexOf('-');
  return idx === -1 ? str : str.substring(0, idx);
}

// Helper to normalize strings for matching
function normalize(str) {
  return str ? str.toString().trim().toLowerCase() : '';
}

// Helper to format date to dd/mm/yyyy
function formatDateToDDMMYYYY(dateStr) {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj)) return '';
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Upload Handler
const paidcreditnoteHandlerMulti = (req, res) => {
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
    const paidCreditNoteSheetName = 'Paidcreditnote';

    if (!wb1.SheetNames.includes(invoiceNoSheetName)) {
      return res.status(400).json({ message: `"${invoiceNoSheetName}" sheet not found in first file.` });
    }
    if (!wb2.SheetNames.includes(paidCreditNoteSheetName)) {
      return res.status(400).json({ message: `"${paidCreditNoteSheetName}" sheet not found in second file.` });
    }

    const dataInvoiceNo = xlsx.utils.sheet_to_json(wb1.Sheets[invoiceNoSheetName], { defval: '' });
    const datapaidCreditNoteRaw = xlsx.utils.sheet_to_json(wb2.Sheets[paidCreditNoteSheetName], { defval: '' });

    unlinkSync(file1Path);
    unlinkSync(file2Path);

    if (dataInvoiceNo.length === 0 || datapaidCreditNoteRaw.length === 0) {
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

    const updatedpaidCreditNote = datapaidCreditNoteRaw.map(row => {
      row['InvoiceNumber'] = row['CreditNoteNumber'] || '';
      row['InvoiceDate'] = row['CNDate'] || '';

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
        if (row[col]) {
          row[col] = formatDateToDDMMYYYY(row[col]);
        }
      });

      if (!row['Description'] || row['Description'].toString().trim() === '') {
        row['Description'] = '.';
      }
      if (!row['Quantity'] || row['Quantity'].toString().trim() === '') {
        row['Quantity'] = 1;
      }
      let rawTax = (row['TaxType'] || '').toString().trim().toUpperCase();
      row['TaxType'] = taxTypeMapping[rawTax] || 'BAS Excluded';


      row['Status'] = 'DRAFT';
      row['LineAmountType'] = 'Exclusive';

      return row;
    });

    uploadedData2 = updatedpaidCreditNote;
    res.json({ message: 'Files uploaded and processed successfully.' });

  } catch (error) {
    console.error('Error in paidcreditnoteHandler:', error);
    res.status(500).json({ message: `Failed to process files: ${error.message}` });
  }
};

// Convert Handler
const paidcreditnoteConvertMulti = (req, res) => {
  if (!uploadedData2.length) {
    return res.status(400).json({ message: 'No uploaded data to convert.' });
  }
  try {
    const csvString = parse(uploadedData2, { fields: allowedColumn });

    const outputDir = join(process.cwd(), 'converted');
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    const outputPath = join(outputDir, 'converted.csv');
    writeFileSync(outputPath, csvString);

    res.json({ message: 'Excel converted to CSV successfully.' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Conversion failed.' });
  }
};

// Download Handler
const paidcreditnoteDownloadMulti = (req, res) => {
  const filePath = join(process.cwd(), 'converted', 'converted.csv');
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
  paidcreditnoteHandlerMulti,
  paidcreditnoteConvertMulti,
  paidcreditnoteDownloadMulti,
};

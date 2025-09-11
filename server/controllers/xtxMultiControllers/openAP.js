import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import xlsx from 'xlsx';
import { Parser } from 'json2csv';

let uploadedData = [];

const fieldMapping = {
  'Customer': 'ContactName',
  'Bill Reference': 'InvoiceNumber',
  'Bill Date': 'InvoiceDate',
  'Due Date': 'DueDate',
  'Total': 'UnitAmount'
};

const allowedColumns = [
  'ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate', 'Type', 'Description',
  'Quantity', 'UnitAmount', 'LineAmount', 'AccountCode', 'TaxType',
  'Currency', 'Status', 'LineAmountType'
];

let invoiceNumberCounter = 1;

function forceText(value) {
  if (value === null || value === undefined) return '';
  value = value.toString().trim();
  if (value === '') return '';
  return `="${value.replace(/"/g, '""')}"`;
}

function formatDate(value) {
  if (!value) return '';
  let dateObj;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    dateObj = value;
  } else if (!isNaN(value) && typeof value !== 'string') {
    dateObj = new Date((value - 25569) * 86400 * 1000);
  } else {
    const parts = value.toString().trim().split(/[\/\-]/);
    if (parts.length === 3) {
      let [day, month, year] = parts;
      if (year.length === 4) {
        day = day.padStart(2, '0');
        month = month.padStart(2, '0');
      } else if (day.length === 4) {
        [year, month, day] = parts;
      }
      if (year.length === 2) {
        year = '20' + year;
      }
      const isoDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      dateObj = new Date(isoDateStr);
    } else {
      return value.toString();
    }
  }

  if (isNaN(dateObj)) return '';
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear();
  return `${d}/${m}/${y}`;
}

function renameFields(row) {
  const renamedRow = {};
  for (const originalKey in row) {
    const newKey = fieldMapping[originalKey.trim()] || originalKey.trim();
    renamedRow[newKey] = row[originalKey];
  }
  return renamedRow;
}

function transformARFields(row) {
  const transformed = {};

  transformed['ContactName'] = row['ContactName'] || '';
  transformed['InvoiceDate'] = row['InvoiceDate'] ? formatDate(row['InvoiceDate']) : '';
  transformed['DueDate'] = row['DueDate'] ? formatDate(row['DueDate']) : '';
  transformed['TaxType'] = 'BAS Excluded';
  transformed['Currency'] = row['Currency'] || '';
  transformed['Description'] = '.';
  transformed['Quantity'] = '1';
  transformed['Status'] = 'AUTHORISED';
  transformed['LineAmountType'] = 'Exclusive';
  transformed['AccountCode'] = '960';

  if (row['InvoiceNumber'] && row['InvoiceNumber'].toString().trim() !== '') {
    transformed['InvoiceNumber'] = forceText(row['InvoiceNumber']);
  } else {
    transformed['InvoiceNumber'] = forceText(`AP-${invoiceNumberCounter++}`);
  }

  const amount = parseFloat(row['UnitAmount']);
  if (!isNaN(amount)) {
    const formattedAmount = forceText(Math.abs(amount).toFixed(2));
    transformed['UnitAmount'] = formattedAmount;
    transformed['LineAmount'] = formattedAmount;
    transformed['Type'] = amount >= 0 ? 'Bill' : 'Bill Credit';
  } else {
    transformed['UnitAmount'] = '';
    transformed['LineAmount'] = '';
    transformed['Type'] = '';
  }

  return transformed;
}

function transformData(data) {
  const transformedRows = [];
  let currentCustomer = '';
  const invoiceToContact = {};
  const dateToContact = {};

  data.forEach((row) => {
    const renamed = renameFields(row);
    const values = Object.values(renamed).map(val => (val || '').toString().trim());
    const firstCol = values[0];
    const otherColsEmpty = values.slice(1).every(val => val === '');

    const invoiceDateStr = renamed['InvoiceDate'] ? renamed['InvoiceDate'].toString().toLowerCase() : '';
    if (invoiceDateStr.includes('total')) return;

    if (firstCol !== '' && otherColsEmpty) {
      currentCustomer = firstCol;
      return;
    }

    if (!renamed['ContactName'] || renamed['ContactName'].trim() === '') {
      renamed['ContactName'] = currentCustomer;
    }

    if (renamed['ContactName']) {
      if (renamed['InvoiceNumber']) {
        invoiceToContact[renamed['InvoiceNumber']] = renamed['ContactName'];
      }
      if (renamed['InvoiceDate']) {
        dateToContact[renamed['InvoiceDate']] = renamed['ContactName'];
      }
    }

    if (!renamed['ContactName'] || renamed['ContactName'].trim() === '') {
      if (renamed['InvoiceNumber'] && invoiceToContact[renamed['InvoiceNumber']]) {
        renamed['ContactName'] = invoiceToContact[renamed['InvoiceNumber']];
      } else if (renamed['InvoiceDate'] && dateToContact[renamed['InvoiceDate']]) {
        renamed['ContactName'] = dateToContact[renamed['InvoiceDate']];
      }
    }

    const isNoteRow = renamed['InvoiceDate'] &&
      (!renamed['InvoiceNumber'] || renamed['InvoiceNumber'].toString().trim() === '') &&
      (!renamed['UnitAmount'] || renamed['UnitAmount'].toString().trim() === '');

    if (isNoteRow) {
      renamed['ContactName'] = renamed['InvoiceDate'];
      renamed['InvoiceDate'] = '';
    }

    const transformed = transformARFields(renamed);
    const finalRow = {};
    allowedColumns.forEach(col => {
      finalRow[col] = transformed[col] !== undefined ? transformed[col] : '';
    });

    transformedRows.push(finalRow);
  });

  return transformedRows;
}

const apHandlerMulti = (req, res) => {
  uploadedData = [];
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = xlsx.utils.sheet_to_json(worksheet, {
      header: 0,
      defval: '',
      raw: true
    });

    uploadedData = jsonData;
 
    unlinkSync(req.file.path);
    res.json({ message: 'File uploaded and parsed successfully.' });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ message: 'Error processing file.' });
  }
};

const apConvertMulti = (req, res) => {
  if (!uploadedData.length) {
    return res.status(400).json({ message: 'No data available to convert.' });
  }

  const transformed = transformData(uploadedData);


  const parser = new Parser({ fields: allowedColumns });
  const csvString = parser.parse(transformed);

  const outputDir = join(process.cwd(), 'converted');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
  }

  const outputPath = join(outputDir, 'converted.csv');
  writeFileSync(outputPath, csvString);

  res.json({ message: 'Data converted successfully.' });
};

const apDownloadMulti = (req, res) => {
  const filePath = join(process.cwd(), 'converted', 'converted.csv');
  if (existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ message: 'Converted file not found.' });
  }
};

export { apHandlerMulti, apConvertMulti, apDownloadMulti };

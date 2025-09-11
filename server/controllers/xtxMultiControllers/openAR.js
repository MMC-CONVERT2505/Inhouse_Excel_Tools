import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { Parser } from 'json2csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let uploadedData = [];

const fieldMapping = {
  'Customer': 'ContactName',
  'Invoice Reference': 'InvoiceNumber',
  'Invoice Date': 'InvoiceDate',
  'Due Date': 'DueDate',
  'Total': 'UnitAmount'
};

const allowedColumns = [
  'ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate', 'Type', 'Description',
  'Quantity', 'UnitAmount', 'LineAmount', 'AccountCode', 'TaxType',
  'Currency', 'Status', 'LineAmountType'
];

let invoiceNumberCounter = 1;

function formatDate(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return value.toISOString().split('T')[0];
  }

  if (!isNaN(value) && typeof value !== 'string') {
    const excelDate = new Date((value - 25569) * 86400 * 1000);
    return excelDate.toISOString().split('T')[0];
  }

  const parts = value.toString().split(/[\/\-]/);
  if (parts.length === 3) {
    let [day, month, year] = parts;
    if (year.length === 2) year = '20' + year;
    return `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return value.toString();
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
    transformed['InvoiceNumber'] = `="${row['InvoiceNumber'].toString()}"`;
  } else {
    transformed['InvoiceNumber'] = `AR-${invoiceNumberCounter++}`;
  }

  const amount = parseFloat(row['UnitAmount']);
  if (!isNaN(amount)) {
    const formattedAmount = `="${Math.abs(amount).toFixed(2)}"`;
    transformed['UnitAmount'] = formattedAmount;
    transformed['LineAmount'] = formattedAmount;
    transformed['Type'] = amount >= 0 ? 'Invoice' : 'Credit Memo';
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

const arHandlerMulti = (req, res) => {
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

const arConvertMulti = (req, res) => {
  if (!uploadedData.length) {
    return res.status(400).json({ message: 'No data available to convert.' });
  }

  const transformed = transformData(uploadedData);


  const parser = new Parser({ fields: allowedColumns });
  const csvString = parser.parse(transformed);

  const outputDir = join(__dirname, '../converted');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
  }

  const outputPath = join(outputDir, 'converted.csv');
  writeFileSync(outputPath, csvString);

  res.json({ message: 'Data converted successfully.' });
};

const arDownloadMulti = (req, res) => {
  const filePath = join(__dirname, '../converted/converted.csv');
  if (existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ message: 'Converted file not found.' });
  }
};

export { arHandlerMulti, arConvertMulti, arDownloadMulti };

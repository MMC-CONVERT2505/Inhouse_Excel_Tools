import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';
import archiver from 'archiver';
// const archiver = require('archiver');


const salesReceiptMapping = {
    'Source Name': '*ContactName',
    'Num': '*InvoiceNumber',
    'Trans #': 'Reference',
    'Date': '*InvoiceDate',
    'Due Date': '*DueDate',
    'Item': 'InventoryItemCode',
    'Description': '*Description',
    'Qty': '*Quantity',
    'Account': '*AccountCode',
    'Tax Code': '*TaxType',
    'Tax Amount': 'TaxAmount',
    'Class': 'TrackingOption1',
    'Debit': 'Debit',
    'Credit': 'Credit'
};

const bankMapping = {
    'Date': 'Date',
    'Trans #': 'Reference',
    'Debit': 'Amount',
    'Num': 'Invoice Number',
    'Account': 'Account',
    'Source Name': 'Name'
};

const allowedSalesReceiptColumns = [
    '*ContactName', 'EmailAddress',
    'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4',
    'POCity', 'PORegion', 'POPostalCode', 'POCountry',
    '*InvoiceNumber','Reference', '*InvoiceDate', '*DueDate', 'Total',
    'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount',
    'Discount', '*AccountCode', '*TaxType', 'TaxAmount',
    'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2',
    'Currency','Branding Theme'
];

const allowedBankColumns = ['Date', 'Reference', 'Amount', 'Invoice Number','Exchange Rate', 'Account', 'Name'];

const reckonToXeroTaxMapping = {
    GST: 'GST on Income',
    FRE: 'GST Free Income',
    NCG: 'GST on Income',
    NCF: 'GST Free Income'
};

let uploadedSalesReceiptFilePath = '';

const uploadSalesReceipt = (req, res) => {
    uploadedSalesReceiptFilePath = req.file.path;
    console.log("Uploaded Sales Receipt File Path: ", uploadedSalesReceiptFilePath);
    res.json({ message: 'Sales Receipt file uploaded successfully.' });
};

const convertSalesReceipt = async (req, res) => {
    try {
        if (!existsSync(uploadedSalesReceiptFilePath)) {
            return res.status(400).json({ error: 'Uploaded sales receipt file not found.' });
        }

        const cleanNumber = (value) => {
            if (typeof value === 'string') {
                return parseFloat(value.replace(/,/g, '').trim()) || 0;
            }
            return parseFloat(value) || 0;
        };

        const originalRows = await parseCSV(uploadedSalesReceiptFilePath);
        const cleanedRows = [];
        const bankRows = [];
        let totalAmt = 0;

        for (const row of originalRows) {
            if ((row['Sales Price'] || '').includes('%') && (row['Account'] || '').toLowerCase().includes('tax payable')) {
                continue; // Skip this row
            }
            const debit = cleanNumber(row['Debit']);
            const credit = cleanNumber(row['Credit']);

            const amtForValidation = -debit + credit;
            row['AMT'] = amtForValidation;
            totalAmt += amtForValidation;

            const accountType = (row['Account Type'] || '').toLowerCase();

            if (accountType.includes('bank')) {
                const bankRow = {};
                Object.entries(bankMapping).forEach(([sourceKey, targetKey]) => {
                    let value = row[sourceKey] || '';
                    if (sourceKey === 'Amount(Debit)') value = debit;
                    if (sourceKey === 'Account') {
                        value = String(value).trim().split(' ')[0]; // keep only first word (usually the number)
                    }
                    bankRow[targetKey] = value;
                });
                bankRows.push(bankRow);
                continue;
            }
             if ((row['Account'] || '').toLowerCase().includes('tax payable')) continue;
            if ((row['Sales Price'] || '').includes('%')) continue;

            let qty = cleanNumber(row['Qty']);
            if (!qty || qty === 0) qty = 1;
            
            const amount = -debit + credit;
            const unitAmount = Math.abs(amount / qty); // NO rounding
            
            row['Qty'] = qty; // Set the qty
            
            row['Description'] = row['Description']?.trim() || '.';
            
            let taxCode = (row['Tax Code'] || '').trim();
            let mappedTax = reckonToXeroTaxMapping[taxCode] || 'BAS Excluded';
            
            // Map fields
            const xeroRow = {};
            Object.entries(salesReceiptMapping).forEach(([sourceKey, targetKey]) => {
                let value = row[sourceKey];
                if (targetKey === '*Quantity') value = qty; // No toFixed
                if (targetKey === '*Description') value = row['Description'];
                if (targetKey === '*TaxType') value = mappedTax;
                if (targetKey === 'TaxAmount') value = Math.abs(cleanNumber(row['Tax Amount'])); // No rounding
                xeroRow[targetKey] = value;
            });
            
            // Special UnitAmount set
            xeroRow['*UnitAmount'] = unitAmount;
            
            // Fill missing columns
            allowedSalesReceiptColumns.forEach(col => {
                if (!(col in xeroRow)) {
                    xeroRow[col] = row[col] !== undefined ? row[col] : '';
                }
            });
            
            if (xeroRow['*AccountCode']) {
                const codeOnly = String(xeroRow['*AccountCode']).split(' ')[0];
                xeroRow['*AccountCode'] = codeOnly;
            }
            
            cleanedRows.push(xeroRow);
        }

        console.log('Total AMT Sum for validation:', totalAmt.toFixed(2));

        const parserSalesReceipt = new Parser({ fields: allowedSalesReceiptColumns });
        const csvSalesReceipt = parserSalesReceipt.parse(cleanedRows);

        const parserBank = new Parser({ fields: allowedBankColumns });
        const csvBank = parserBank.parse(bankRows);

        const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
        mkdirSync(outputDir, { recursive: true });

        // const salesReceiptFileName = 'converted_sales_receipt.csv';
        // const bankFileName = 'converted_bank_data.csv';

        writeFileSync(join(outputDir,  'converted_sales_receipt.csv'), csvSalesReceipt);
        writeFileSync(join(outputDir, 'converted_bank_data.csv'), csvBank);
        

        return res.json({
            message: 'Sales Receipt and Bank data converted successfully.',
            downloadLinks: {
                salesReceipt: `/download-sales-receipt/ converted_sales_receipt.csv`,
                bankData: `/download-sales-receipt/converted_bank_data.csv`
            }
        });

    } catch (error) {
        console.error('Error during sales receipt conversion:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// const downloadSalesReceipt = (req, res) => {
//     const fileName = req.params.filename;
//     const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);

//     if (!existsSync(filePath)) {
//         return res.status(404).json({ error: 'File not found' });
//     }

//     res.download(filePath, fileName, (err) => {
//         if (err) {
//             console.error('Error downloading:', err);
//             res.status(500).json({ error: 'Download failed' });
//         }
//     });
// };


const downloadSalesReceipt =  (_req, res) => {

  const files = [
    'converted_sales_receipt.csv',
    'converted_bank_data.csv' 
  ];

  const zipName = 'conversion_data.zip';
  res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
  res.setHeader('Content-Type', 'application/zip');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  files.forEach(file => {
    const filePath = join(process.cwd(), DOWNLOAD_DIR, file);
    if (existsSync(filePath)) {
      archive.append(createReadStream(filePath), { name: file });
    }
  });

  archive.finalize();
};


function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

export  { uploadSalesReceipt, convertSalesReceipt, downloadSalesReceipt };

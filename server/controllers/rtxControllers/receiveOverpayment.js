import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

// Receive Overpayment mapping according to image and simple naming
const receiveOverpaymentMapping = {
    'Date': 'Date',
    'Name': 'Contact Name',
    'Num': 'Reference',
    'Split': 'Bank Account Code',
    'Quantity': 'Quantity',
    'unitAmount': 'Unit Amount',
    'Open Balance': 'Line Amount',
    'Tax Code': 'Tax Rate',
    'Trans #': 'Trans #'
};

const allowedReceiveOverpaymentColumns = [
    'Date','Contact Name','Reference',
    'Description','Item Code', 'Item Account Code',
    'Bank Account Code', 'Quantity','unitAmount','lineAmount',
    'Tax Rate','Tax Amount','line Amount Types','Tracking Name 1','Tracking Option 1',
    'Tracking Name 2','Tracking Option 2',
    'Currency Code','Exchange Rate','Trans #'
];

let uploadedReceiveOverpaymentPath = '';

// Upload function for Receive Overpayment CSV
const uploadReceiveOverpayment = (req, res) => {
    uploadedReceiveOverpaymentPath = req.file.path;
    res.json({ message: 'Receive Overpayment file uploaded successfully.' });
};

// Utility: parse CSV file
const parseCSV = (filePath) => new Promise((resolve, reject) => {
    const results = [];
    createReadStream(filePath)
        .pipe(csvParser())
        .on('data', data => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
});

// Conversion function for Receive Overpayment
const convertReceiveOverpayment = async (req, res) => {
    try {
        if (!existsSync(uploadedReceiveOverpaymentPath)) {
            return res.status(400).json({ error: 'Receive Overpayment file not found.' });
        }

        const rows = await parseCSV(uploadedReceiveOverpaymentPath);

        // Filter rows where Type is "Payment"
        const filteredRows = rows.filter(row => {
            const type = (row['Type'] || '').toLowerCase();
            return type === 'payment';
        });

        // Map filtered rows to template with receiveOverpaymentMapping
        const mappedRows = filteredRows.map(row => {
            const mappedRow = {};

            // Map fields using receiveOverpaymentMapping
            Object.entries(receiveOverpaymentMapping).forEach(([inputKey, outputKey]) => {
                if (outputKey === 'Bank Account Code') {
                    const val = row[inputKey] || '';
                    const cleaned = val.split(' ')[0].trim(); // Clean account code
                    mappedRow[outputKey] = cleaned;
                } else if (outputKey === 'Reference') {
                    mappedRow[outputKey] = row[inputKey] || '';
                } else {
                    mappedRow[outputKey] = row[inputKey] || '';
                }
            });

            // Amount: convert to positive number and format
            let amountNum = parseFloat((row['Open Balance'] || '0').toString().replace(/,/g, '').trim()) || 0;
            if (amountNum < 0) amountNum = Math.abs(amountNum);
            mappedRow['lineAmount'] = amountNum.toFixed(2);

            // Add fixed fields
            mappedRow['Item Account Code'] = '610';
            mappedRow['Description'] = '.';
            mappedRow['Tax Rate'] = 'BAS Excluded';
            mappedRow['line Amount Types'] = 'NoTax';

            // Ensure all allowed fields exist
            allowedReceiveOverpaymentColumns.forEach(col => {
                if (!(col in mappedRow)) mappedRow[col] = '';
            });

            return mappedRow;
        });

        // Create output directory if not exists
        const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
        mkdirSync(outputDir, { recursive: true });

        // Write CSV
        const csv = new Parser({ fields: allowedReceiveOverpaymentColumns }).parse(mappedRows);
        const outputFilePath = join(outputDir, 'converted_receive_overpayment.csv');
        writeFileSync(outputFilePath, csv);

        return res.json({
            message: 'Receive Overpayment file converted successfully.',
            downloadLink: '/download-receive-overpayment/converted_receive_overpayment.csv',
            fileName
        });

    } catch (error) {
        console.error('Error converting Receive Overpayment:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

// Download function
const downloadReceiveOverpayment = (req, res) => {
    const fileName = req.params.filename;
    const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);
    if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath, fileName, err => {
        if (err) {
            console.error('Download error:', err);
            res.status(500).json({ error: 'Download failed' });
        }
    });
};

export  { uploadReceiveOverpayment, convertReceiveOverpayment, downloadReceiveOverpayment };

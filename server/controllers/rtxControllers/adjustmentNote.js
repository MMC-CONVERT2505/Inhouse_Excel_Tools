import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

const adjustmentMapping = {
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
    'Debit':'Debit',
    'Credit':'Credit'
};

const allowedAdjustmentColumns = [
    '*ContactName', 'EmailAddress',
    'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4',
    'POCity', 'PORegion', 'POPostalCode', 'POCountry',
    '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate', 'Total',
    'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount',
    'Discount', '*AccountCode', '*TaxType', 'TaxAmount',
    'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2',
    'Currency', 'BrandingTheme'
];

const reckonToXeroTaxMapping = {
    GST: 'GST on Income',
    FRE: 'GST Free Income',
    NCG: 'GST on Income',
    NCF: 'GST Free Income'
};

let uploadedAdjustmentFilePath = '';

const uploadAdjustmentNote = (req, res) => {
    uploadedAdjustmentFilePath = req.file.path;
    console.log("Uploaded Adjustment Note File Path: ", uploadedAdjustmentFilePath);
    res.json({ message: 'Adjustment note file uploaded successfully.' });
};

const convertAdjustmentNote = async (req, res) => {
    try {
        if (!existsSync(uploadedAdjustmentFilePath)) {
            return res.status(400).json({ error: 'Uploaded adjustment note file not found.' });
        }

        const cleanNumber = (value) => {
            if (typeof value === 'string') {
                return parseFloat(value.replace(/,/g, '').trim()) || 0;
            }
            return parseFloat(value) || 0;
        };

        const originalRows = await parseCSV(uploadedAdjustmentFilePath);
        const cleanedRows = [];
        let totalAmt = 0;

        for (const row of originalRows) {
            const debit = cleanNumber(row['Debit']);
            const credit = cleanNumber(row['Credit']);

            const amtForValidation = -debit + credit;
            row['AMT'] = amtForValidation;
            totalAmt += amtForValidation;

            let trueAmt = 0;
            if (debit !== 0) {
                trueAmt = -debit;
            } else if (credit !== 0) {
                trueAmt = credit;
            }

            if ((row['Account Type'] || '').toLowerCase().includes('accounts receivable')) continue;
            if ((row['Sales Price'] || '').includes('%')) continue;

            let qty = cleanNumber(row['Qty']);
            if (!qty || qty === 0) qty = 1;
            row['Qty'] = qty;

            const unitAmount = parseFloat((trueAmt / qty).toFixed(2));

            row['Description'] = row['Description']?.trim() || '.';

            let taxCode = row['Tax Code'];
            const accountType = row['Account Type'];
            let mappedTax = 'BAS Excluded';

            if (reckonToXeroTaxMapping[taxCode]) {
                mappedTax = reckonToXeroTaxMapping[taxCode];
            }

            if (!taxCode || taxCode.trim() === '' || ['EXP', 'ITS'].includes(taxCode)) {
                mappedTax = 'BAS Excluded';
            }

            if (['Direct Costs', 'Expense', 'Current Liability'].includes(accountType)) {
                if (['GST', 'NCG'].includes(taxCode)) mappedTax = 'GST on Expenses';
                else if (['FRE', 'NCF'].includes(taxCode)) mappedTax = 'GST Free Expenses';
            }

            if (['Income', 'Current Asset', 'Fixed Asset'].includes(accountType)) {
                if (['GST', 'NCG'].includes(taxCode)) mappedTax = 'GST on Income';
                else if (['FRE', 'NCF'].includes(taxCode)) mappedTax = 'GST Free Income';
            }

            const xeroRow = {};

            Object.entries(adjustmentMapping).forEach(([sourceKey, targetKey]) => {
                let value = row[sourceKey];
                if (targetKey === '*Quantity') value = qty;
                if (targetKey === '*Description') value = row['Description'];
                if (targetKey === '*TaxType') value = mappedTax;
                if (targetKey === 'TaxAmount') {
                    const taxAmt = cleanNumber(row['Tax Amount']);
                    value = taxAmt > 0 ? -Math.abs(taxAmt) : taxAmt;  // Specific condition for Adjustment Note
                    value = parseFloat(value.toFixed(2));
                }
                xeroRow[targetKey] = value;
            });

            xeroRow['*UnitAmount'] = unitAmount;

            allowedAdjustmentColumns.forEach(col => {
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

        const parser = new Parser({ fields: allowedAdjustmentColumns });
        const csvOutput = parser.parse(cleanedRows);

        const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
        mkdirSync(outputDir, { recursive: true });

        const fileName = 'converted_adjustment_note.csv';
        const outputPath = join(outputDir, fileName);
        writeFileSync(outputPath, csvOutput);

        return res.json({
            message: 'Adjustment note data converted successfully.',
            downloadLink: `/download-adjustment-note/${fileName}`,
            fileName
        });

    } catch (error) {
        console.error('Error during adjustment note conversion:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const downloadAdjustmentNote = (req, res) => {
    const fileName = req.params.filename;
    const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);

    if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, fileName, (err) => {
        if (err) {
            console.error('Error downloading:', err);
            res.status(500).json({ error: 'Download failed' });
         }
    });
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

export  {
    uploadAdjustmentNote,
    convertAdjustmentNote,
    downloadAdjustmentNote
};

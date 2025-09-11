import { move, pathExists } from "fs-extra";
import ExcelJS from "exceljs";
import { readExcelToJson } from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "openar";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "Num": "Invoice No",
    "Customer": "Customer",
    "Date": "Invoice Date",
    "Due Date": "Due Date",
    "Memo/Description": "Product/Service Description",
    "Open Balance": "Product/Service Amount",
    "Foreign Open Balance": "Foreign Open Balance",
    "Class": "Product/Service Class",
    "Currency": "Currency",
    "Exchange Rate": "Exchange Rate",
    "Terms": "Terms"
};

const changeColumnNameForAdjustmentNote = {
    "Invoice No": "Adjustment Note No",
    "Customer": "Customer",
    "Invoice Date": "Adjustment Note Date",
    "Memo/Description": "Product/Service Description",
    "Open Balance": "Product/Service Amount",
    "Foreign Open Balance": "Foreign Open Balance",
    "Class": "Product/Service Class",
    "Currency": "Currency",
    "Exchange Rate": "Exchange Rate",
    "Terms": "Terms"
};

const allowedInvoiceColumns = [
    "Invoice No", "Customer", "Invoice Date", "Due Date", "Product/Service",
    "Product/Service Description", "Product/Service Quantity", "Product/Service Rate",
    "Product/Service Amount", "Product/Service Class", "Currency Code", "Exchange Rate", "Terms"
];

const allowedAdjustmentNoteColumns = [
    "Adjustment Note No", "Customer", "Adjustment Note Date", "Product/Service",
    "Product/Service Description", "Product/Service Quantity", "Product/Service Rate",
    "Product/Service Amount", "Product/Service Class", "Currency", "Exchange Rate", "Terms"
];

function renameColumns(data, changeMap) {
    return data.map(row => {
        const newRow = {};
        for (const key in row) {
            const newKey = changeMap[key] || key;
            newRow[newKey] = row[key];
        }
        return newRow;
    });
}

function assignInvoiceType(data) {
    return data.map(row => {
        let amount = parseFloat(row["Product/Service Amount"]) || 0;
        row["Type"] = amount < 0 ? "Adjustment note" : "Invoice";
        amount = Math.abs(amount);
        const formattedAmount = Number(amount.toFixed(2));
        row["Product/Service Amount"] = formattedAmount;
        row["Product/Service Rate"] = formattedAmount;
        row["Product/Service Quantity"] = 1;
        row["Product/Service"] = "Sales";
        return row;
    });
}

function assignMultiCurrencyInvoiceType(data) {
    return data.map(row => {
        let amount = parseFloat(row["Foreign Open Balance"]) || 0;
        row["Type"] = amount < 0 ? "Adjustment note" : "Invoice";
        amount = Math.abs(amount);
        const formattedAmount = Number(amount.toFixed(2));
        row["Product/Service Amount"] = formattedAmount;
        row["Product/Service Rate"] = formattedAmount;
        row["Product/Service Quantity"] = 1;
        row["Product/Service"] = "Sales";
        return row;
    });
}

function normalizeInvoiceNumbers(data) {
    return data.map(row => {
        let invoiceNo = row["Invoice No"]?.toString().trim() || "";
        row["Invoice No"] = invoiceNo.slice(0, 21);
        return row;
    });
}

// 🟢 Upload Controller
export async function uploadOpenAR(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");

    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅Australia Open-AR file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processOpenAR(req, res) {
    try {
        const jsonData = await readExcelToJson(excelFilePath);
        const renamedData = renameColumns(jsonData, changeColumnName);
        const withType = assignInvoiceType(renamedData);
        const normalizedData = normalizeInvoiceNumbers(withType);

        // Split by Type
        const invoiceData = normalizedData.filter(row => row.Type === "Invoice");
        const adjustmentNoteDataRaw = normalizedData.filter(row => row.Type === "Adjustment note");

        // Rename for adjustment notes
        const adjustmentNoteData = renameColumns(adjustmentNoteDataRaw, changeColumnNameForAdjustmentNote);

        // Filter columns
        const filteredInvoiceData = invoiceData.map(row => {
            const filtered = {};
            for (const col of allowedInvoiceColumns) {
                filtered[col] = row[col] ?? "";
            }
            return filtered;
        });

        const filteredAdjustmentNoteData = adjustmentNoteData.map(row => {
            const filtered = {};
            for (const col of allowedAdjustmentNoteColumns) {
                filtered[col] = row[col] ?? "";
            }
            return filtered;
        });

        // Save combined JSON
        await saveJsonToFile([...filteredInvoiceData, ...filteredAdjustmentNoteData], outputJsonPath);

        // Create Excel with 2 sheets
        const workbook = new ExcelJS.Workbook();

        const invoiceSheet = workbook.addWorksheet("Invoices");
        invoiceSheet.columns = allowedInvoiceColumns.map(header => ({ header, key: header }));
        invoiceSheet.addRows(filteredInvoiceData);

        const adjustmentSheet = workbook.addWorksheet("Adjustment Notes");
        adjustmentSheet.columns = allowedAdjustmentNoteColumns.map(header => ({ header, key: header }));
        adjustmentSheet.addRows(filteredAdjustmentNoteData);

        await workbook.xlsx.writeFile(modifiedExcelPath);

        console.log("✅Australia Open-AR Excel processed with 2 sheets.");
        res.send("Excel processed and split into Invoices and Adjustment Notes.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

export async function processMultiCurrencyOpenAR(req, res) {
    try {
        const jsonData = await readExcelToJson(excelFilePath);
        const renamedData = renameColumns(jsonData, changeColumnName);
        const withType = assignMultiCurrencyInvoiceType(renamedData);
        const normalizedData = normalizeInvoiceNumbers(withType);

        // Split by Type
        const invoiceData = normalizedData.filter(row => row.Type === "Invoice");
        const adjustmentNoteDataRaw = normalizedData.filter(row => row.Type === "Adjustment note");

        // Rename for adjustment notes
        const adjustmentNoteData = renameColumns(adjustmentNoteDataRaw, changeColumnNameForAdjustmentNote);

        // Filter columns
        const filteredInvoiceData = invoiceData.map(row => {
            const filtered = {};
            for (const col of allowedInvoiceColumns) {
                filtered[col] = row[col] ?? "";
            }
            return filtered;
        });

        const filteredAdjustmentNoteData = adjustmentNoteData.map(row => {
            const filtered = {};
            for (const col of allowedAdjustmentNoteColumns) {
                filtered[col] = row[col] ?? "";
            }
            return filtered;
        });

        // Save combined JSON
        await saveJsonToFile([...filteredInvoiceData, ...filteredAdjustmentNoteData], outputJsonPath);

        // Create Excel with 2 sheets
        const workbook = new ExcelJS.Workbook();

        const invoiceSheet = workbook.addWorksheet("Invoices");
        invoiceSheet.columns = allowedInvoiceColumns.map(header => ({ header, key: header }));
        invoiceSheet.addRows(filteredInvoiceData);

        const adjustmentSheet = workbook.addWorksheet("Adjustment Notes");
        adjustmentSheet.columns = allowedAdjustmentNoteColumns.map(header => ({ header, key: header }));
        adjustmentSheet.addRows(filteredAdjustmentNoteData);

        await workbook.xlsx.writeFile(modifiedExcelPath);

        console.log("✅Australia MultiCurrency Open-AR Excel processed with 2 sheets.");
        res.send("Excel processed and split into Invoices and Adjustment Notes.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadOpenAR(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedOpenAR.xlsx", (err) => {
                if (err) console.error("❌ Download error:", err.message);
                else console.log("✅ Excel file downloaded.");
            });
        } else {
            res.status(404).send("Modified Excel file not found. Please process it first.");
        }
    } catch (err) {
        console.error("❌ File check error:", err.message);
        res.status(500).send("Error checking or downloading the file.");
    }
}

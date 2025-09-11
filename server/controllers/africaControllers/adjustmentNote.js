import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "Adjustmentnote";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "No.": "Adjustment Note No",
    "Name": "Customer",
    "Date": "Adjustment Note Date",
    "Service Date": "Service Date",
    "Product/Service": "Product/Service",
    "Memo/Description": "Product/Service Description",
    "Qty": "Product/Service Quantity",
    "Rate": "Product/Service Rate",
    "Amount": "Product/Service Amount",
    "Tax Code": "Product/Service Tax Code",
    "GST": "Product/Service Tax Amount",
    "Class": "Product/Service Class",
    "Customer memo": "Note to customer",
    "Memo": "Memo on statement",
    "SKU": "SKU",
    "Term": "Terms",
    "Discount": "Discount Percent",
    "Currency": "Currency Code",
    "Exchange rate": "Exchange rate",
    "Location": "Location",
    "Debit": "Debit",
    "Credit": "Credit",
    "Account": "Account",
    "Unit Price/Rate": "Unit Price/Rate"
};

const allowedColumns = [
    "Adjustment Note No", "Customer", "Adjustment Note Date", "Global Tax Calculation", "Service Date", "Product/Service",
    "Product/Service Description", "Product/Service Quantity", "Product/Service Rate", "Product/Service Amount", "Product/Service Tax Code",
    "Product/Service Tax Amount", "Product/Service Class", "Note to customer", "Memo on statement", "SKU", "Terms", "Discount Percent",
    "Currency Code", "Exchange rate", "Location"
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

function processData(data) {
    return data.map(row => {
        if (row["Product/Service Tax Amount"] === undefined || row["Product/Service Tax Amount"] === "") {
            row["Product/Service Tax Amount"] = 0;
        }
        if (!row["Product/Service Quantity"]) {
            row["Product/Service Quantity"] = 1;
        }
        if (!row["Product/Service Tax Code"]) {
            row["Product/Service Tax Code"] = "Out Of Scope";
            row["Product/Service Tax Amount"] = 0;
        }

        // Always make Product/Service Tax Amount positive
        row["Product/Service Tax Amount"] = Math.abs(parseFloat(row["Product/Service Tax Amount"]) || 0).toFixed(2);

        if (typeof row["Product/Service Quantity"] === "string" || typeof row["Product/Service Quantity"] === "number") {
            row["Product/Service Quantity"] = row["Product/Service Quantity"].toString().replace("-", "");
        }

        const debit = parseFloat(row["Debit"] || 0);
        const credit = parseFloat(row["Credit"] || 0);
        row["Product/Service Amount"] = (debit - credit).toFixed(2);

        const amount = parseFloat(row["Product/Service Amount"]) || 0;
        const quantity = parseFloat(row["Product/Service Quantity"]) || 1;
        row["Product/Service Rate"] = quantity !== 0 ? (amount / quantity).toFixed(2) : 0;

        row["Global Tax Calculation"] = "TaxExcluded";

        return row;
    });
}

function processAdjustmentMultiCurrencyData(data, currencyCode) {
    return data.map(row => {
        // Fill missing values
        if (row["Product/Service Tax Amount"] === undefined || row["Product/Service Tax Amount"] === "") {
            row["Product/Service Tax Amount"] = 0;
        }
        if (!row["Product/Service Quantity"]) {
            row["Product/Service Quantity"] = 1;
        }
        if (!row["Product/Service Tax Code"]) {
            row["Product/Service Tax Code"] = "Out Of Scope";
            row["Product/Service Tax Amount"] = 0;
        }

        // Remove minus sign from Product/Service Quantity
        if (typeof row["Product/Service Quantity"] === "string" || typeof row["Product/Service Quantity"] === "number") {
            row["Product/Service Quantity"] = row["Product/Service Quantity"].toString().replace("-", "");
        }

        // Calculate Amount and Rate
        const debit = parseFloat(row["Debit"] || 0);
        const credit = parseFloat(row["Credit"] || 0);
        if (row["Currency Code"] === currencyCode) {
            row["Product/Service Amount"] = (debit - credit).toFixed(2);
        } else {
            // Logic for handling foreign currencies (Amount = Foreign Amount)
            row["Product/Service Amount"] = parseFloat(row["Foreign Amount"]);
        }

        const amount = parseFloat(row["Product/Service Amount"]) || 0;
        const quantity = parseFloat(row["Product/Service Quantity"]) || 1;
        row["Product/Service Rate"] = quantity !== 0 ? (amount / quantity).toFixed(2) : 0;

        const taxAmount = parseFloat(row["Product/Service Tax Amount"]);
        row["Global Tax Calculation"] = "TaxExcluded";

        return row;
    });
}

function removeInvalidRows(data) {
    return data.filter(row => {
        const accountName = (row["Account"] || "").toLowerCase();
        if (accountName.includes("receivable")) return false;
        if (accountName.includes("tax payable") || accountName.includes("gst payable") || accountName.includes("vat payable")) return false;
        return true;
    });
}

function filterColumns(data) {
    return data.map(row => {
        const filteredRow = {};
        for (const key of allowedColumns) {
            filteredRow[key] = row.hasOwnProperty(key) ? row[key] : "";
        }
        return filteredRow;
    });
}

function normalizeInvoiceNumbers(data) {
    return data.map(row => {
        let invoiceNo = row["Adjustment Note No"]?.toString().trim() || "";
        row["Adjustment Note No"] = invoiceNo.slice(0, 21);
        return row;
    });
}

function sortByInvoiceNo(data) {
    return data.sort((a, b) => {
        const aInv = (a["Adjustment Note No"] || "").toLowerCase();
        const bInv = (b["Adjustment Note No"] || "").toLowerCase();
        return aInv.localeCompare(bInv);
    });
}

// 🟢 Upload Controller
export async function uploadAdjustmentNote(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅Australia Adjustmnet Note file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processAdjustmentNote(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);
        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = processData(jsonData);
        jsonData = removeInvalidRows(jsonData);
        jsonData = normalizeInvoiceNumbers(jsonData);
        jsonData = sortByInvoiceNo(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Product/Service Amount", "Product/Service Rate", "Product/Service Tax Amount"];
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields);

        console.log("✅Australia Adjustment Note Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// ⚙️ Process Controller
export async function processMultiCurrencyAdjustment(req, res) {
    const { currencyCode } = req.body;
    try {
        let jsonData = await readExcelToJson(excelFilePath);
        jsonData = renameColumns(jsonData, changeColumnName);
        // jsonData = processData(jsonData);
        jsonData = processAdjustmentMultiCurrencyData(jsonData, currencyCode);
        jsonData = removeInvalidRows(jsonData);
        jsonData = normalizeInvoiceNumbers(jsonData);
        jsonData = sortByInvoiceNo(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Product/Service Amount", "Product/Service Rate", "Product/Service Tax Amount"];
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields);

        console.log("✅Australia MultiCurrency Adjustment Note Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadAdjustmentNote(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedAdjustmentNote.xlsx", (err) => {
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

import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "invoice";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "No.": "Invoice No",
    "Name": "Customer",
    "Date": "Invoice Date",
    "Due Date": "Due Date",
    "Service Date": "Service Date",
    "Product/Service": "Product/Service",
    "Memo/Description": "Product/Service Description",
    "Qty": "Product/Service Quantity",
    "Rate": "Product/Service Rate",
    "Tax Code": "Product/Service Tax Code",
    "GST": "Product/Service Tax Amount",
    "Class": "Product/Service Class",
    "Customer memo": "Note to customer",
    "Memo": "Memo on statement",
    "SKU": "SKU",
    "Term": "Terms",
    "Discount": "Discount Percent",
    "Currency": "Currency Code",
    "Exchange Rate": "Exchange Rate",
    "Debit": "Debit",
    "Credit": "Credit",
    "Account": "Account", // Make sure Account is mapped
    "Unit Price/Rate": "Unit Price/Rate" // Make sure Unit Price/Rate is mapped
};

const allowedColumns = [
    "Invoice No", "Customer", "Invoice Date", "Due Date", "Global Tax Calculation", "Service Date",
    "Product/Service", "Product/Service Description", "Product/Service Quantity", "Product/Service Rate",
    "Product/Service Amount", "Product/Service Tax Code", "Product/Service Tax Amount", "Product/Service Class",
    "Note to customer", "Memo on statement", "SKU", "Terms", "Discount Percent", "Currency Code", "Exchange Rate"
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

function fillDownDueDate(data) {
    let lastDueDate = "";
    return data.map(row => {
        if (row["Due Date"]) {
            lastDueDate = row["Due Date"];
        } else {
            row["Due Date"] = lastDueDate;
        }
        return row;
    });
}

function processInvoiceData(data) {
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
        row["Product/Service Amount"] = (credit - debit).toFixed(2);

        const amount = parseFloat(row["Product/Service Amount"]) || 0;
        const quantity = parseFloat(row["Product/Service Quantity"]) || 1;
        row["Product/Service Rate"] = quantity !== 0 ? (amount / quantity).toFixed(2) : 0;

        const taxAmount = parseFloat(row["Product/Service Tax Amount"]);
        row["Global Tax Calculation"] = "TaxExcluded";

        return row;
    });
}

function processInvoiceMultiCurrencyData(data, currencyCode) {
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
            row["Product/Service Amount"] = (credit - debit).toFixed(2);
        } else {
            // Logic for handling foreign currencies (Amount = Foreign Amount)
            row["Product/Service Amount"] =parseFloat(row["Foreign Amount"]);
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
        if (accountName.includes("receivables")) return false;
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
        let invoiceNo = row["Invoice No"]?.toString().trim() || "";
        row["Invoice No"] = invoiceNo.slice(0, 21);
        return row;
    });
}

function sortByInvoiceNo(data) {
    return data.sort((a, b) => {
        const aInv = (a["Invoice No"] || "").toLowerCase();
        const bInv = (b["Invoice No"] || "").toLowerCase();
        return aInv.localeCompare(bInv);
    });
}

// 🟢 Upload Controller
export async function uploadInvoice(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅Australia Invoice file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}


// ⚙️ Process Controller
export async function processInvoice(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);
        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = fillDownDueDate(jsonData);
        jsonData = processInvoiceData(jsonData);
        jsonData = removeInvalidRows(jsonData);
        jsonData = normalizeInvoiceNumbers(jsonData);
        jsonData = sortByInvoiceNo(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);

        const numberFields = ["Product/Service Amount", "Product/Service Rate", "Product/Service Tax Amount"]; // 🟰 Add this

        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields); // 🟰 Pass numberFields

        console.log("Global Invoice Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

export async function processMultiCurrencyInvoice(req, res) {
    const { currencyCode } = req.body;
    try {
        let jsonData = await readExcelToJson(excelFilePath);
        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = fillDownDueDate(jsonData);
        jsonData = processInvoiceMultiCurrencyData(jsonData, currencyCode);
        jsonData = removeInvalidRows(jsonData);
        jsonData = normalizeInvoiceNumbers(jsonData);
        jsonData = sortByInvoiceNo(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);

        const numberFields = ["Product/Service Amount", "Product/Service Rate", "Product/Service Tax Amount"]; // 🟰 Add this

        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields); // 🟰 Pass numberFields

        console.log("Global Invoice Multi Currency Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadInvoice(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedInvoice.xlsx", (err) => {
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

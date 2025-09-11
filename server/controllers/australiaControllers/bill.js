import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "bill";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "No.": "BillNo",
    "Account": "Account",
    "Name": "Supplier",
    "Date": "BillDate",
    "Due Date": "DueDate",
    "Service Date": "Service Date",
    "Product/Service": "Product/Service",
    "Memo/Description": "Description",
    "Tax Code": "Tax Code",
    "GST": "Tax Amount",
    "Class": "Class",
    "Qty": "Quantity",
    "SKU": "SKU",
    "Term": "Terms",
    "Currency": "Currency Code",
    "Exchange rate": "Exchange rate",
    "Location": "Location",
    "Debit": "Debit",
    "Credit": "Credit",
    "Unit Price/Rate": "Unit Price/Rate"
};

const allowedColumns = [
    "BillNo", "Supplier", "BillDate", "DueDate", "Global Tax Calculation", "Unit Price/Rate", "Account",
    "Description", "Product/Service", "Quantity", "Line Amount", "Tax Code", "Tax Amount",
    "Class", "Location", "Terms", "Currency Code", "Exchange Rate", "SKU", "Service Date",
];

// ✅ Modified renameColumns with normalization
function renameColumns(data, changeMap) {
    const normalizedMap = {};
    for (const key in changeMap) {
        normalizedMap[key.trim().toLowerCase()] = changeMap[key];
    }

    return data.map(row => {
        const newRow = {};
        for (const key in row) {
            const normalizedKey = key.trim().toLowerCase();
            const newKey = normalizedMap[normalizedKey] || key.trim();
            newRow[newKey] = row[key];
        }
        return newRow;
    });
}

// ✅ Sort by BillNo
function sortByInvoiceNo(data) {
    return data.sort((a, b) => {
        const aInv = (a["BillNo"] ?? "").toString().toLowerCase();
        const bInv = (b["BillNo"] ?? "").toString().toLowerCase();
        return aInv.localeCompare(bInv);
    });
}

// ✅ Fill Down DueDate (Excel F5 functionality)
function fillDownDueDate(data) {
    let lastDueDate = "";
    return data.map(row => {
        if (row["DueDate"] && row["DueDate"].toString().trim() !== "") {
            lastDueDate = row["DueDate"];
        } else {
            row["DueDate"] = lastDueDate;
        }
        return row;
    });
}

function processData(data) {
    return data.map(row => {
        if (row["Tax Amount"] === undefined || row["Tax Amount"] === "") {
            row["Tax Amount"] = 0;
        }
        if (!row["Quantity"]) {
            row["Quantity"] = 1;
        }
        if (!row["Tax Code"]) {
            row["Tax Code"] = "Out Of Scope";
            row["Tax Amount"] = 0;
        }

        row["Tax Amount"] = Math.abs(parseFloat(row["Tax Amount"]) || 0).toFixed(4);

        if (typeof row["Quantity"] === "string" || typeof row["Quantity"] === "number") {
            row["Quantity"] = row["Quantity"].toString().replace("-", "");
        }

        const debit = parseFloat(row["Debit"] || 0);
        const credit = parseFloat(row["Credit"] || 0);
        row["Product/Service Amount"] = (debit - credit).toFixed(4);

        const amount = parseFloat(row["Line Amount"]) || 0;
        const quantity = parseFloat(row["Quantity"]) || 1;
        row["Unit Price/Rate"] = quantity !== 0 ? (amount / quantity).toFixed(4) : 0;

        row["Global Tax Calculation"] = "TaxExcluded";

        return row;
    });
}
function processMultiCurrencyData(data, currencyCode) {
    return data.map(row => {
        if (row["Tax Amount"] === undefined || row["Tax Amount"] === "") {
            row["Tax Amount"] = 0;
        }
        if (!row["Quantity"]) {
            row["Quantity"] = 1;
        }
        if (!row["Tax Code"]) {
            row["Tax Code"] = "Out Of Scope";
            row["Tax Amount"] = 0;
        }

        row["Tax Amount"] = Math.abs(parseFloat(row["Tax Amount"]) || 0).toFixed(4);

        if (typeof row["Quantity"] === "string" || typeof row["Quantity"] === "number") {
            row["Quantity"] = row["Quantity"].toString().replace("-", "");
        }

        const debit = parseFloat(row["Debit"] || 0);
        const credit = parseFloat(row["Credit"] || 0);

        // Logic for handling Base Currency (Amount = Debit - Credit)
        if (row["Currency Code"] === currencyCode) {
            row["Line Amount"] = (debit - credit).toFixed(4);
        } else {
            // Logic for handling foreign currencies (Amount = Foreign Amount)
            row["Line Amount"] = parseFloat(row["Foreign Amount"]);
        }

        const amount = parseFloat(row["Line Amount"]) || 0;
        const quantity = parseFloat(row["Quantity"]) || 1;
        row["Unit Price/Rate"] = quantity !== 0 ? (amount / quantity).toFixed(4) : 0;

        row["Global Tax Calculation"] = "TaxExcluded";

        return row;
    });
}

function removeInvalidRows(data) {
    return data.filter(row => {
        const accountName = (row["Account"] || "").toLowerCase();
        if (accountName.includes("creditors")) return false;
        if (accountName.includes("tax payable") || accountName.includes("gst payable") || accountName.includes("vat payable") || accountName.includes("accounts payable")) return false;
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
        let invoiceNo = row["BillNo"]?.toString().trim() || "";
        row["BillNo"] = invoiceNo.slice(0, 21);
        return row;
    });
}

// 🟩 Upload Controller
export async function uploadBill(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅Australia Bill file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processBill(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        // 👇 Correct sequence as per your instruction
        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = sortByInvoiceNo(jsonData);
        jsonData = fillDownDueDate(jsonData);
        jsonData = processData(jsonData);
        jsonData = removeInvalidRows(jsonData);
        jsonData = normalizeInvoiceNumbers(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Unit Price/Rate", "Line Amount", "Tax Amount"];
        const dateFields = ["BillDate", "DueDate"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅Australia Bill Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

export async function processMultiCurrencyBill(req, res) {
    const { currencyCode } = req.body;  // Currency code passed from frontend

    try {
        let jsonData = await readExcelToJson(excelFilePath);

        // 👇 Correct sequence as per your instruction
        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = sortByInvoiceNo(jsonData);
        jsonData = fillDownDueDate(jsonData);
        jsonData = processMultiCurrencyData(jsonData, currencyCode); // 🟰 Pass currencyCode to processData
        jsonData = removeInvalidRows(jsonData);
        jsonData = normalizeInvoiceNumbers(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Unit Price/Rate", "Line Amount", "Tax Amount"];
        const dateFields = ["BillDate", "DueDate"];
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("Australia MultiCurrency Bill Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadBill(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedBill.xlsx", (err) => {
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


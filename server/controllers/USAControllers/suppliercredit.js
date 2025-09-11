import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "suppliercredit";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "No.": "Ref No",
    "Account": "Account",
    "Name": "Supplier",
    "Date": "Date",
    "Service Date": "Service Date",
    "Product/Service": "Product/Service",
    "Memo/Description": "Description",
    "Tax Code": "Tax Code",
    "GST": "Tax Amount",
    "Class": "Class",
    "Qty": "Qty",
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
    "Date", "Ref No", "Supplier", "Global Tax Calculation", "Account", "Description",
    "Amount", "Tax Code", "Tax Amount", "Unit Price/Rate", "Qty", "Class", "Location",
    "Terms", "Currency", "Exchange rate", "SKU", "Service Date", "Product/Service",
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
        const aInv = (a["Ref No"] ?? "").toString().toLowerCase();
        const bInv = (b["Ref No"] ?? "").toString().toLowerCase();
        return aInv.localeCompare(bInv);
    });
}

// ✅ Fill Down DueDate (Excel F5 functionality)
// function fillDownDueDate(data) {
//         let lastDueDate = "";
//         return data.map(row => {
//             if (row["DueDate"] && row["DueDate"].toString().trim() !== "") {
//                 lastDueDate = row["DueDate"];
//             } else {
//                 row["DueDate"] = lastDueDate;
//             }
//             return row;
//         });
//     }

function processData(data) {
    return data.map(row => {
        if (row["Tax Amount"] === undefined || row["Tax Amount"] === "") {
            row["Tax Amount"] = 0;
        }
        if (!row["Qty"]) {
            row["Qty"] = 1;
        }
        if (!row["Tax Code"]) {
            row["Tax Code"] = "Out Of Scope";
            row["Tax Amount"] = 0;
        }

        row["Tax Amount"] = Math.abs(parseFloat(row["Tax Amount"]) || 0).toFixed(2);

        if (typeof row["Qty"] === "string" || typeof row["Qty"] === "number") {
            row["Qty"] = row["Qty"].toString().replace("-", "");
        }

        const debit = parseFloat(row["Debit"] || 0);
        const credit = parseFloat(row["Credit"] || 0);
        row["Amount"] = (credit - debit).toFixed(2);

        const amount = parseFloat(row["Amount"]) || 0;
        const Qty = parseFloat(row["Qty"]) || 1;
        row["Unit Price/Rate"] = Qty !== 0 ? (amount / Qty).toFixed(2) : 0;

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
            row["Amount"] = (credit - debit).toFixed(2);
        } else {
            // Logic for handling foreign currencies (Amount = Foreign Amount)
            row["Amount"] = parseFloat(row["Foreign Amount"]);
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
        let invoiceNo = row["Ref No"]?.toString().trim() || "";
        row["Ref No"] = invoiceNo.slice(0, 21);
        return row;
    });
}

// 🟩 Upload Controller
export async function uploadSupplierCredit(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅USASupplier Credit file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processSupplierCredit(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        // 👇 Correct sequence as per your instruction
        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = sortByInvoiceNo(jsonData);
        // jsonData = fillDownDueDate(jsonData);
        jsonData = processData(jsonData);
        jsonData = removeInvalidRows(jsonData);
        jsonData = normalizeInvoiceNumbers(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Amount", "Tax Amount", "Unit Price/Rate"];
        const dateFields = ["Date"];
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅USASupplier Credit Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// ⚙️ Process MultiCurrencyController
export async function processMultiCurrencySupplierCredit(req, res) {
    const { currencyCode } = req.body;  // Currency code passed from frontend

    try {
        let jsonData = await readExcelToJson(excelFilePath);

        // 👇 Correct sequence as per your instruction
        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = sortByInvoiceNo(jsonData);
        // jsonData = fillDownDueDate(jsonData);
        // jsonData = processData(jsonData);
        jsonData = processMultiCurrencyData(jsonData, currencyCode); // 🟰 Pass currencyCode to processData
        jsonData = removeInvalidRows(jsonData);
        jsonData = normalizeInvoiceNumbers(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Amount", "Tax Amount", "Unit Price/Rate"];
        const dateFields = ["Date"];
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅USAMultiCurrency Supplier Credit Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadSupplierCredit(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedSupplierCredit.xlsx", (err) => {
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

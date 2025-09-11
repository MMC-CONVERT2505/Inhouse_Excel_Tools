import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "cheque";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "TxnNumber": "TxnNumber",
    "RefNumber": "RefNumber",
    "AccountRefFullName": "Bank Account",
    "PayeeEntityRefFullName": "Payee",
    "TxnDate": "Payment Date",
    "Memo": "Memo",
    "GlobalTaxCalculation": "Global Tax Calculation",
    "ExpenseLineAccountRefFullName": "Expense Account",
    "ExpenseLineMemo": "Expense Description",
    "ExpenseLineAmount": "Expense Line Amount",
    "ExpenseLineTaxCodeRefFullName": "Expense Tax Code",
    "ExpenseLineTaxAmount": "Expense Account Tax Amount",
    "CurrencyRefListID": "Currency Code",
    "ExpenseLineClassRefFullName": "Expense Class",
    "ExchangeRate": "Exchange Rate",
    "ExpenseLineCustomerRefFullName": "Expense Customer ",
};

const allowedColumns = [
    "Cheque no", "Bank Account", "Payee", "Payment Date", "Memo", "Global Tax Calculation",
    "Expense Account", "Expense Description", "Expense Line Amount", "Expense Tax Code",
    "Expense Account Tax Amount", "Expense Class", "Currency Code", "Exchange Rate", "Expense Customer"
];

// ✅ Rename columns with normalization
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

// ✅ Add "Cheque no" = TxnNumber + "-" + RefNumber
function addChequeNumber(data) {
    return data.map(row => {
        const txn = row["TxnNumber"] || "";
        const ref = row["RefNumber"] || "";
        row["Cheque no"] = `${txn}_${ref}`.replace(/^-|-$/g, "");
        return row;
    });
}

// ✅ Filter allowed output columns
function filterColumns(data) {
    return data.map(row => {
        const filteredRow = {};
        for (const key of allowedColumns) {
            filteredRow[key] = row.hasOwnProperty(key) ? row[key] : "";
        }
        return filteredRow;
    });
}

function processData(data) {
    return data.map(row => {
        if (row["Expense Account Tax Amount"] === undefined || row["Expense Account Tax Amount"] === "") {
            row["Expense Account Tax Amount"] = 0;
        }
        if (!row["Expense Tax Code"]) {
            row["Expense Tax Code"] = "Out Of Scope";
            row["Expense Account Tax Amount"] = 0;
        }     

        row["Global Tax Calculation"] = "TaxExcluded";

        return row;
    });
}
function processMultiCurrencyData(data, currencyCode) {
    return data.map(row => {
        if (row["Expense Account Tax Amount"] === undefined || row["Expense Account Tax Amount"] === "") {
            row["Expense Account Tax Amount"] = 0;
        }
        if (!row["Expense Tax Code"]) {
            row["Expense Tax Code"] = "Out Of Scope";
            row["Expense Account Tax Amount"] = 0;
        }     

        row["Global Tax Calculation"] = "TaxExcluded";

        const debit = parseFloat(row["Debit"] || 0);
        const credit = parseFloat(row["Credit"] || 0);

        // Logic for handling Base Currency (Amount = Debit - Credit)
        if (row["Currency Code"] === currencyCode) {
            row["Line Amount"] = (debit - credit).toFixed(4);
        } else {
            // Logic for handling foreign currencies (Amount = Foreign Amount)
            row["Line Amount"] = parseFloat(row["Foreign Amount"]);
        }

        return row;
    });
}

// 🟩 Upload Controller
export async function uploadCheque(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅Australia Cheque file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processCheque(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = addChequeNumber(jsonData);
        jsonData = filterColumns(jsonData);                  
        jsonData = processData(jsonData);
        
        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Expense Line Amount", "Expense Account Tax Amount", "Exchange Rate"];
        const dateFields = ["Payment Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅Australia Cheque Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}


// ⚙️ Process Controller
export async function processMultiCurrencyCheque(req, res) {
    const { currencyCode } = req.body;  // Currency code passed from frontend
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = addChequeNumber(jsonData);
        jsonData = filterColumns(jsonData);                  
        jsonData = processMultiCurrencyData(jsonData, currencyCode);
        
        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Expense Line Amount", "Expense Account Tax Amount", "Exchange Rate"];
        const dateFields = ["Payment Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅Australia MultiCurrency Cheque Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadCheque(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedCheque.xlsx", (err) => {
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

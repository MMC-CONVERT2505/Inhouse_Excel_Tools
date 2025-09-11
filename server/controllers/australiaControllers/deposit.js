import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "deposit";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "TxnID": "TxnID",
    "DocNumber": "DocNumber",
    "TxnDate": "Date",
    "DepositToAccountRefFullName": "Deposit To Account",
    "DepositLineDetailEntityRefFullName": "Received From",
    "GlobalTaxCalculation": "Global Tax Calculation",
    "DepositLineDetailAccountRefFullName": "Line Account",
    "DepositLineDescription": "Line Description",
    "DepositLineAmount": "Line Amount",
    "DepositLineDetailClassRefFullName": "Line Class",
    "TransactionLocationType": "Location",
    "DepositLineDetailTaxCodeRefFullName": "Line Tax Code",
    "PrivateNote": "Memo",
    "CurrencyRefListID": "Currency Code",
    "ExchangeRate": "Exchange Rate",
    "DepositLineDetailPaymentMethodRefFullName": "Line Payment Method",
    "DepositLineDetailTxnType": "Linked Transaction Type",
};

const allowedColumns = [
    "Deposit No",
    "Date",
    "Deposit To Account",
    "Received From",
    "Global Tax Calculation",
    "Line Account",
    "Line Description",
    "Line Amount",
    "Line Class",
    "Location",
    "Line Tax Code",
    "Memo",
    "Currency Code",
    "Exchange Rate",
    "Line Payment Method",
    "Linked Transaction Type",
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

// ✅ Add "Deposit no" = TxnID + "-" + DocNumber
function addDepositNumber(data) {
    return data.map(row => {
        const txn = row["TxnID"] || "";
        const doc = row["DocNumber"];

        if (doc !== undefined && doc !== null && String(doc).trim() !== "") {
            row["Deposit No"] = `${txn}_${doc}`.replace(/^-|-$/g, "");
        } else {
            row["Deposit No"] = txn;
        }

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
        if (!row["Line Tax Code"]) {
            row["Line Tax Code"] = "Out Of Scope";
        }     

        row["Global Tax Calculation"] = "TaxExcluded";

        return row;
    });
}

function processMultiCurrencyData(data) {
    return data.map(row => {
        if (!row["Line Tax Code"]) {
            row["Line Tax Code"] = "Out Of Scope";
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

        row["Global Tax Calculation"] = "TaxExcluded";

        return row;
    });
}

// 🟩 Upload Controller
export async function uploadDeposit(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅Australia Deposit file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processDeposit(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = addDepositNumber(jsonData);
        jsonData = filterColumns(jsonData);
        jsonData = processData(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Line Amount", "Exchange Rate"];
        const dateFields = ["Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅Australia Deposit Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}


// ⚙️ Process Controller
export async function processMultiCurrencyDeposit(req, res) {
    const { currencyCode } = req.body;  // Currency code passed from frontend

    try {
        let jsonData = await readExcelToJson(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = addDepositNumber(jsonData);
        jsonData = filterColumns(jsonData);
        // jsonData = processData(jsonData);
        jsonData = processMultiCurrencyData(jsonData, currencyCode);

        
        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Line Amount", "Exchange Rate"];
        const dateFields = ["Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅Australia MultiCurrency Deposit Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadDeposit(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedDeposit.xlsx", (err) => {
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

import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "creditcardcharge";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "TxnID": "TxnID",
    "RefNumber": "RefNumber",
    "AccountRefFullName": "Account",
    "EntityRefFullName": "Payee",
    "TxnDate": "Payment Date",
    "Privatenote": "Memo",
    "GlobalTaxCalculation": "Global Tax Calculation",
    "ExpenseLineAccountRefFullName": "Expense Account",
    "ExpenseLineMemo": "Expense Description",
    "ExpenseLineAmount": "Expense Line Amount",
    "ExpenseLineTaxCodeRefFullName": "Expense Tax Code",
    "ExpenseLineTaxAmount": "Expense Account Tax Amount",
    "ExpenseLineClassRefFullName": "Expense Class",
    "CurrencyRefListID": "Currency Code",
    "ExchangeRate": "Exchange Rate",
    "PaymentMethodRefFullName": "Payment Method",
    "ExpenseLineCustomerRefFullName": "Expense Customer",
};

const allowedColumns = [
    "Ref No",
    "Account",
    "Payee",
    "Payment Date",
    "Memo",
    "Global Tax Calculation",
    "Expense Account",
    "Expense Description",
    "Expense Line Amount",
    "Expense Tax Code",
    "Expense Account Tax Amount",
    "Expense Class",
    "Currency Code",
    "Exchange Rate",
    "Payment Method",
    "Expense Customer ",
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


function addDepositNumber(data) {
    return data.map(row => {
        const txn = row["TxnID"] || "";
        const ref = row["RefNumber"];

        if (ref !== undefined && ref !== null && String(ref).trim() !== "") {
            row["Ref No"] = `${txn}_${ref}`.replace(/^-|-$/g, "");
        } else {
            row["Ref No"] = txn;
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

        return row;
    });
}

// 🟩 Upload Controller
export async function uploadCreditCardCharge(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("USA Credit Card Charge (Expense) file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processCreditCardCharge(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = addDepositNumber(jsonData);
        jsonData = filterColumns(jsonData);
        jsonData = processData(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Expense Account Tax Amount", "Exchange Rate", "Expense Line Amount"];
        const dateFields = ["Payment Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("USA Credit Card Charge (Expense) Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

export async function processMultiCCurrencyCreditCardCharge(req, res) {
    const { currencyCode } = req.body;  // Currency code passed from frontend
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = addDepositNumber(jsonData);
        jsonData = filterColumns(jsonData);
        jsonData = processMultiCurrencyData(jsonData, currencyCode);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Expense Account Tax Amount", "Exchange Rate", "Expense Line Amount"];
        const dateFields = ["Payment Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("USA MultiCureency Credit Card Charge (Expense) Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadCreditCardCharge(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedCreditCardCharge.xlsx", (err) => {
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
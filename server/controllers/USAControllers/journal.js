import { move, pathExists } from "fs-extra";
import { readExcelToJson } from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "journal";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "TxnNumber": "TxnNumber",
    "RefNumber": "RefNumber",
    "TxnDate": "Journal Date",
    "Memo": "Memo",
    "JournalLineAccountRefFullName": "Account",
    "JournalLineDebitAmount": "JournalLineDebitAmount",
    "JournalLineCreditAmount": "JournalLineCreditAmount",
    "JournalLineMemo": "Description",
    "JournalLineEntityRefFullName": "Name",
    "JournalLineTaxCodeRefFullName": "Tax Code",
    "JournalLineClassRefFullName": "Class",
    "CurrencyRefListID": "Currency Code",
    "ExchangeRate": "Exchange Rate",
    "TransactionLocationType": "Location",

};

const allowedColumns = [
    "Journal No",
    "Journal Date",
    "Memo",
    "Account",
    "Amount",
    "Description",
    "Name",
    "Tax Code",
    "Class",
    "Currency Code",
    "Exchange Rate",
    "Location"
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


function addJournalNumber(data) {
    return data.map(row => {
        const txn = row["TxnNumber"] || "";
        const ref = row["RefNumber"];

        if (ref !== undefined && ref !== null && String(ref).trim() !== "") {
            row["Journal No"] = `${txn}_${ref}`.replace(/^-|-$/g, "");
        } else {
            row["Journal No"] = txn;
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
        const debit = parseFloat(row["JournalLineDebitAmount"]) || 0;
        const credit = parseFloat(row["JournalLineCreditAmount"]) || 0;

        const amount = debit - credit;
        row["Amount"] = isNaN(amount) ? "" : amount.toFixed(2);

        return row;
    });
}

function processMultiCurrencyData(data, currencyCode) {
    return data.map(row => {
        const debit = parseFloat(row["JournalLineDebitAmount"]) || 0;
        const credit = parseFloat(row["JournalLineCreditAmount"]) || 0;

        const amount = debit - credit;
        
        // Logic for handling Base Currency (Amount = Debit - Credit)
        if (row["Currency Code"] === currencyCode) {
            row["Amount"] = amount.toFixed(2);
        } else {
            // Logic for handling foreign currencies (Amount = Foreign Amount)
            row["Amount"] = parseFloat(row["Foreign Amount"]);
        }
        row["Amount"] = isNaN(amount) ? "" : amount.toFixed(2);
        return row;
    });
}

// 🟩 Upload Controller
export async function uploadJournal(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅USAJournal file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processJournal(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = addJournalNumber(jsonData);
        jsonData = processData(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Amount", "Exchange Rate"];
        const dateFields = ["Journal Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅USAJournal Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// ⚙️ Process Controller
export async function processMultiCurrencyJournal(req, res) {
    const { currencyCode } = req.body;  // Currency code passed from frontend
    try {
        let jsonData = await readExcelToJson(excelFilePath);
        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = addJournalNumber(jsonData);
        jsonData = processMultiCurrencyData(jsonData, currencyCode);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Amount", "Exchange Rate"];
        const dateFields = ["Journal Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅USAMultiCurrency Journal Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadJournal(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedJournal.xlsx", (err) => {
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
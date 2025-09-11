import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "transfer";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "FromAccountRefFullName": "Transfer Funds From",
    "ToAccountRefFullName": "Transfer Funds To",
    "Amount": "Transfer Amount",
    "TxnDate": "Date",
    "Memo": "Privatenote",
    "CurrencyRefListID": "Currency Code",
    "ExchangeRate": "Exchange Rate",
    "TxnID": "Ref no.",
};

const allowedColumns = [
    "Transfer Funds From",
    "Transfer Funds To",
    "Transfer Amount",
    "Date",
    "Privatenote",
    "Currency Code",
    "Exchange Rate",
    "Ref no.",
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

// 🟩 Upload Controller
export async function uploadTransfer(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅USA Transfer file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processTransfer(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Transfer Amount", "Exchange Rate"];
        const dateFields = ["Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("USA Transfer Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadTransfer(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedTransfer.xlsx", (err) => {
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

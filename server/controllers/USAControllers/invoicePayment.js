import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "invoicepayment";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "TxnNumber": "TxnNumber",
    "RefNumber": "RefNumber",
    "CustomerRefFullName": "Customer",
    "TxnDate": "Payment Date",
    "PaymentMethodRefFullName": "Payment method",
    "Memo": "Memo",
    "DepositToAccountRefFullName": "Deposit To Account Name",
    "AppliedToTxnRefNumber": "Invoice No",
    "AppliedToTxnAmount": "Amount",
    "CurrencyRefListID": "Currency Code",
    "ExchangeRate": "Exchange Rate",
};

const allowedColumns = [
    "Ref No",
    "Customer",
    "Payment Date",
    "Payment method",
    "Memo",
    "Deposit To Account Name",
    "Invoice No",
    "Amount",
    "Currency Code",
    "Exchange Rate",
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

// ✅ Add "Ref No" = TxnNumber + "-" + RefNumber
function addInvoiceNumber(data) {
    return data.map(row => {
        const txn = row["TxnNumber"] || "";
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

// 🟩 Upload Controller
export async function uploadInvoicePayment(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("USA Invoice Payment file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processInvoicePayment(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = addInvoiceNumber(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Amount", "Exchange Rate"];
        const dateFields = ["Payment Date"]
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("USA Invoice Payment Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadInvoicePayment(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedInvoicePayment.xlsx", (err) => {
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

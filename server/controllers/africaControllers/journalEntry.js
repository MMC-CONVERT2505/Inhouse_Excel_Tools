import { move, pathExists } from "fs-extra";
import { readExcelToJson } from "../../utils/excelReader.js";
import { saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";
import * as XLSX from "xlsx";

const type = "journalentry";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "Date": "Date",
    "Num": "Num",
    "Date": "Journal Date",
    "Transaction Type": "Transaction Type",
    "Account": "Account",
    "Debit": "Debit",
    "Credit": "Credit",
    "Memo/Description": "Description",
    "Name": "Name",
    "Tax Code": "Tax Code",
    "Class": "Class",
    "Currency": "Currency Code",
    "Exchange Rate": "Exchange Rate",
};

const allowedColumns = [
    "Journal No",
    "Journal Date",
    "Name",
    "Transaction Type",
    "Account",
    "Amount",
    "Description",
    "Memo",
    "Tax Code",
    "Class",
    "Currency Code",
    "Exchange Rate",
];

// ✅ Normalize and rename columns
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

// 🟩 Upload Controller
export async function uploadJournalEntry(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅ Journal Entry file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processJournalEntry(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);
        jsonData = renameColumns(jsonData, changeColumnName);

        // Fill-down and processing
        let lastDate = "", lastTransactionType = "", lastNum = "";
        jsonData = jsonData.map(row => {
            // Fill-down
            row["Journal Date"] = row["Journal Date"]?.toString().trim() || lastDate;
            lastDate = row["Journal Date"];

            row["Transaction Type"] = row["Transaction Type"]?.toString().trim() || lastTransactionType;
            lastTransactionType = row["Transaction Type"];

            row["Num"] = row["Num"]?.toString().trim() || lastNum;
            lastNum = row["Num"];

            // Format date
            if (row["Journal Date"]) {
                const rawDate = new Date(row["Journal Date"]);
                if (!isNaN(rawDate)) {
                    const day = String(rawDate.getDate()).padStart(2, '0');
                    const month = String(rawDate.getMonth() + 1).padStart(2, '0');
                    const year = rawDate.getFullYear();
                    row["Journal Date"] = `${day}/${month}/${year}`;
                } else if (typeof row["Journal Date"] === "string" && row["Journal Date"].includes(" ")) {
                    row["Journal Date"] = row["Journal Date"].split(" ")[0].trim();
                }
            }

            // Journal No
            if (row["Journal Date"] && row["Num"]) {
                const parts = row["Journal Date"].split("/");
                if (parts.length === 3) {
                    const [dd, mm, yyyy] = parts;
                    row["Journal No"] = `${yyyy}${mm}${dd}-${row["Num"]}`;
                } else {
                    row["Journal No"] = row["Num"];
                }
            } else {
                row["Journal No"] = row["Num"] || "";
            }

            // Amount = Debit - Credit
            const credit = parseFloat(row["Credit"]) || 0;
            const debit = parseFloat(row["Debit"]) || 0;
            let amount = debit - credit;
            if (isNaN(amount)) amount = 0;
            row["Amount"] = parseFloat(amount.toFixed(2));

            return row;
        });

        // Remove blank Account rows
        jsonData = jsonData.filter(row => row["Account"] && row["Account"].toString().trim() !== "");

        // Filter only allowed columns
        jsonData = jsonData.map(row => {
            const filtered = {};
            allowedColumns.forEach(col => {
                filtered[col] = row[col] !== undefined && row[col] !== null ? row[col] : "";
            });
            return filtered;
        });

        // Save intermediate JSON
        await saveJsonToFile(jsonData, outputJsonPath);

        // Group by Transaction Type
        const grouped = {};
        jsonData.forEach(row => {
            const type = row["Transaction Type"] || "Unknown";
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(row);
        });

        // Create Excel workbook with multiple sheets
        const workbook = XLSX.utils.book_new();
        for (const [type, rows] of Object.entries(grouped)) {
            const sheet = XLSX.utils.json_to_sheet(rows, { header: allowedColumns });
            XLSX.utils.book_append_sheet(workbook, sheet, type.substring(0, 31));
        }

        // Write final Excel file
        XLSX.writeFile(workbook, modifiedExcelPath);

        console.log("✅ Journal Entry Excel processed with multiple sheets.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadJournalEntry(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedJournalEntry.xlsx", (err) => {
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

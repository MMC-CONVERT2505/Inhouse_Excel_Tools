import { move, pathExists } from "fs-extra";
import xlsx from "xlsx";
import { parse } from "date-fns";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "openingbalance";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "Debit": "Debit",
    "Credit": "Credit",
};

const allowedColumns = [
    "Journal No",
    "Journal Date",
    "Account",
    "Amount",
    "Currency Code",
    "Exchange Rate",
];

// 🔄 Rename columns with normalization
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

// 🔎 Filter allowed output columns
function filterColumns(data) {
    return data.map(row => {
        const filteredRow = {};
        for (const key of allowedColumns) {
            filteredRow[key] = row.hasOwnProperty(key) ? row[key] : "";
        }
        return filteredRow;
    });
}

// ⚙️ Business logic
function processData(data) {
    return data.map(row => {
        const debit = parseFloat(row["Debit"]) || 0;
        const credit = parseFloat(row["Credit"]) || 0;
        const amount = debit - credit;

        row["Amount"] = isNaN(amount) ? "" : amount.toFixed(2);
        row["Journal No"] = "Opening balance";

        // 🛠 Replace Account values if matched
        const accountValue = (row["Account"] || "").toString().toLowerCase();
        if (accountValue === "trade receivables" || accountValue === "trade creditors") {
            row["Account"] = "Retained earnings";
        }

        return row;
    });
}

// 🧠 Custom Excel reader & preprocessor
function readAndPreprocessOpeningBalance(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // 🧠 Extract and clean Journal Date from cell A3
    let journalDateRaw = sheet["A3"]?.v || "As of December 31, 2022";
    journalDateRaw = journalDateRaw.replace(/^As of\s*/i, "").trim();

    let parsedDate;
    try {
        parsedDate = parse(journalDateRaw, "MMMM d, yyyy", new Date());
    } catch {
        parsedDate = new Date("2022-12-31");
    }

    const journalDate = parsedDate.toLocaleDateString("en-GB"); // "31/12/2023"

    // Read sheet from row 4 (index 3), skipping A1, A2, A3
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 3 });
    if (rawData.length < 2) return [];

    const headers = rawData[0].slice(1); // Skip column A
    let dataRows = rawData.slice(1);

    // ✂️ Stop reading if "Total" appears in Column A
    const totalIndex = dataRows.findIndex(row => (row[0] || "").toString().trim().toLowerCase() === "total");
    if (totalIndex !== -1) {
        dataRows = dataRows.slice(0, totalIndex); // Only keep rows before "Total"
    }

    const jsonData = dataRows.map((row) => {
        const rowObj = {};
        rowObj["Account"] = row[0];
        headers.forEach((header, i) => {
            rowObj[header] = row[i + 1];
        });
        rowObj["Journal Date"] = journalDate;
        return rowObj;
    });

    return jsonData;
}

// 📤 Upload Controller
export async function uploadOpeningBalance(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅Australia Opening Balance file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process Controller
export async function processOpeningBalance(req, res) {
    try {
        let jsonData = readAndPreprocessOpeningBalance(excelFilePath);

        jsonData = renameColumns(jsonData, changeColumnName);
        jsonData = processData(jsonData);
        jsonData = filterColumns(jsonData);

        await saveJsonToFile(jsonData, outputJsonPath);
        const numberFields = ["Amount", "Exchange Rate"];
        const dateFields = ["Journal Date"];
        await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

        console.log("✅Australia Opening Balance Excel processed.");
        res.send("Excel processed successfully with all business rules applied.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download Controller
export async function downloadOpeningBalance(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);
        if (exists) {
            res.download(modifiedExcelPath, "modifiedOpeningBalance.xlsx", (err) => {
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

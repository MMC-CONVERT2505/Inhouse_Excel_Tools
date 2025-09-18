import { move, pathExists } from "fs-extra";
import { readExcelToJson } from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "coa";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
    "Account No.": "Account number",
    "Account": "Account name",
    "Type": "Account type",
    "Detail type": "Detail type",
    "Tax rate": "Tax rate",
    "Description": "Description",
    "Currency": "Currency"
};

const allowedColumns = ["Account number", "Account name", "Account type", "Detail type", "Description", "Tax rate", "Currency"];

const filterColumns = (data) => {
    return data.map(row => {
        const filteredRow = {};
        for (const key of allowedColumns) {
            if (row.hasOwnProperty(key)) {
                filteredRow[key] = row[key];
            }
        }
        return filteredRow;
    });
};

const mapType = (qboType) => {
    const map = {
        "Current liabilities": "Current liabilities",
        "Accounts receivable": "Accounts receivable (A/R)",
        "Fixed assets": "Fixed assets",
        "Other Current Assets": "Non-current assets",
        "Accounts Payable": "Accounts Payable (A/P)",
        "Credit card": "Credit card",
        "Current assets": "Current assets",
        "Other Current Liabilities": "Non-current liabilities",
        "Equity": "Owner's equity",
        "Income": "Income",
        "Cost of Goods Sold": "Cost of sales",
        "Expenses": "Expenses",
        "Other income": "Other income",
        "Other expense": "Other expense",
        "Bank": "Cash and cash equivalents",
        "Long Term Liability": "Non-current liabilities",
        "Suspense": "Non-current liabilities",
        "Non-Posting": "Non-current liabilities",
    };
    return map[qboType] || null;
};


const mapDetailType = (type) => {
    const map = {
        "Current liabilities": "Other current liabilities",
        "Accounts receivable (A/R)": "Accounts receivable (A/R)",
        "Fixed assets": "Other fixed assets",
        "Non-current assets": "Other non-current assets",
        "Accounts Payable (A/P)": "Accounts Payable (A/P)",
        "Credit card": "Credit Card",
        "Current assets": "Other current assets",
        "Non-current liabilities": "Other non-current liabilities",
        "Owner's equity": "Owner's Equity",
        "Income": "Revenue - General",
        "Cost of sales": "Supplies and materials - COS",
        "Expenses": "Office/General Administrative Expenses",
        "Other income": "Other Miscellaneous Income",
        "Other expense": "Other Expense",
        "Cash and cash equivalents": "Cash and cash equivalents/Bank",
        "Non-current liabilities": "Other non-current liabilities"
    };
    return map[type] || null;
};

const mapTaxRate = (tax) => {
    const map = {
        "GST": "GST",
        "GST free": "GST free",
        "Out of Scope": "Out of Scope",
        "GST free purchases": "GST free purchases",
        "GST on purchases": "GST on purchases",
    };
    return map[tax] || null;
};

// 📝 Rename columns according to changeColumnName
const renameColumns = (data) => {
    return data.map(row => {
        const newRow = {};
        for (const key in row) {
            // Agar mapping hai to naya naam lo, warna original
            const newKey = changeColumnName[key] || key;
            newRow[newKey] = row[key];
        }
        return newRow;
    });
};

// 📤 Upload Excel file
export async function uploadCoa(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");

    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅ Africa COA file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process and convert COA data
// ⚙️ Process and convert COA data
export async function processCoa(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        // 1. Rename columns
        jsonData = renameColumns(jsonData);

        // 2. Map types, detail types, tax rates
        jsonData = jsonData.map(row => {
            const typeValue = mapType(row["Account type"]);
            if (typeValue) row["Account type"] = typeValue;

            const detailTypeValue = mapDetailType(row["Account type"]);
            if (detailTypeValue) row["Detail type"] = detailTypeValue;

            const taxRateValue = mapTaxRate(row["Tax rate"]);
            if (taxRateValue) row["Tax rate"] = taxRateValue;

            return row;
        });

        // 3. Remove unwanted rows (Retained Earnings & Owner's equity)
        jsonData = jsonData.filter(row => {
            const accName = row["Account name"]?.trim().toLowerCase();
            return !(accName === "retained earnings" || accName === "owner's equity" || accName === "member equity");
        });

        // 4. Keep only allowed columns
        const filteredData = filterColumns(jsonData);

        // 5. Save processed data
        await saveJsonToFile(filteredData, outputJsonPath);
        await writeJsonToExcel(filteredData, modifiedExcelPath);

        console.log("✅ Africa COA Excel processed.");
        res.send("COA data processed and saved.");
    } catch (error) {
        console.error("❌ Error processing COA:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download processed Excel
export async function downloadCoa(req, res) {
    try {
        const fileExists = await pathExists(modifiedExcelPath);

        if (!fileExists) {
            return res.status(404).send("Modified Excel file not found. Please process it first.");
        }

        res.download(modifiedExcelPath, "modifiedCoa.xlsx", (err) => {
            if (err) {
                console.error("❌ Download error:", err.message);
            } else {
                console.log("✅ Africa Excel file downloaded.");
            }
        });
    } catch (err) {
        console.error("❌ Error checking file existence:", err.message);
        res.status(500).send("Error checking file for download.");
    }
}

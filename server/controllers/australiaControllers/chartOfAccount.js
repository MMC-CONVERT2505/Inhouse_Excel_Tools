import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";



const type = "coa";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const allowedColumns = ["Account No.", "Account", "Type", "Detail type", "Description", "Tax rate", "Currency"];

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
        "Fixed assets":"Fixed assets",
        "Other Current Assets":"Non-current assets",
        "Accounts Payable":"Accounts Payable (A/P)",
        "Credit card":"Credit card",
        "Current assets":"Current assets",
        "Other Current Liabilities":"Non-current liabilities",
        "Equity":"Owner's equity",
        "Income":"Income",
        "Cost of Goods Sold":"Cost of sales",
        "Expenses":"Expenses",
        "Other income":"Other income",
        "Other expense":"Other expense",
        "Bank":"Cash and cash equivalents",
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
        "Cost of sales": "Cost of Sales",
        "Expenses": "Office/General Administrative Expenses",
        "Other income": "Other Miscellaneous Income",
        "Other expense": "Other Expense",
        "Cash and cash equivalents": "Cash and cash equivalents",
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

// 📤 Upload Excel file
export async function uploadCoa(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");

    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅Australia COA file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// ⚙️ Process and convert COA data
export async function processCoa(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        // Optionally enforce validation
        // for (const row of jsonData) {
        //     if (!row["Account No."]) {
        //         return res.status(400).send("Account number is mandatory!");
        //     }
        // }

        jsonData = jsonData.map(row => {
            const typeValue = mapType(row.Type);
            if (typeValue) row["Type"] = typeValue;

            const detailTypeValue = mapDetailType(row.Type);
            if (detailTypeValue) row["Detail type"] = detailTypeValue;

            const taxRateValue = mapTaxRate(row["Tax rate"]);
            if (taxRateValue) row["Tax rate"] = taxRateValue;

            return row;
        });

        const filteredData = filterColumns(jsonData);

        await saveJsonToFile(filteredData, outputJsonPath);
        await writeJsonToExcel(filteredData, modifiedExcelPath);

        console.log("✅Australia COA Excel processed.");
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
                console.log("✅ Excel file downloaded.");
            }
        });
    } catch (err) {
        console.error("❌ Error checking file existence:", err.message);
        res.status(500).send("Error checking file for download.");
    }
}

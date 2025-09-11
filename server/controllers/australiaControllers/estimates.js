import { move, pathExists } from "fs-extra";
import { readExcelToJson } from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "estimates";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
        "TxnID": "TxnID",
        "DocNumber": "DocNumber",
        "CustomerRefFullName": "Customer",
        "TxnDate": "Estimate Date",
        "ExpirationDate": "Expiration Date",
        "TxnStatus": "Estimate Status",
        "AcceptedBy": "Accepted By",
        "AcceptedDate": "Accepted Date",
        "PrivateNote": "Memo",
        "CustomerMemo": "Message displayed on estimate",
        "GlobalTaxCalculation": "Global Tax Calculation",
        "EstimateLineItemRefFullName": "Product/Service",
        "EstimateLineDesc": "Product/Service Description",
        "EstimateLineQuantity": "Product/Service Quantity",
        "EstimateLineRate": "Product/Service Rate",
        "EstimateLineAmount": "Product/Service Amount",
        "EstimateLineTaxCodeRefFullName": "Product/Service Tax Code",
        "EstimateLineTaxAmount": "Product/Service Tax Amount",
        "EstimateLineClassRefFullName": "Product/Service Class",
        "CurrencyRefListID": "Currency Code",
        "ExchangeRate": "Exchange Rate",
        "CustomFieldPONumber": "CustomFieldPONumber",
};

const allowedColumns = [
        "Estimate No",
        "Customer",
        "Estimate Date",
        "Expiration Date",
        "Estimate Status",
        "Accepted By",
        "Accepted Date",
        "Memo",
        "Message displayed on estimate",
        "Global Tax Calculation",
        "Discount Percent",
        "Product/Service",
        "Product/Service Description",
        "Product/Service Quantity",
        "Product/Service Rate",
        "Product/Service Amount",
        "Product/Service Tax Code",
        "Product/Service Tax Amount",
        "Product/Service Class",
        "Location",
        "Currency Code",
        "Exchange Rate",
        "CustomFieldPONumber",
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
                const ref = row["DocNumber"];

                if (ref !== undefined && ref !== null && String(ref).trim() !== "") {
                        row["Estimate No"] = `${txn}_${ref}`.replace(/^-|-$/g, "");
                } else {
                        row["Estimate No"] = txn;
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
                if (row["Product/Service Tax Amount"] === undefined || row["Product/Service Tax Amount"] === "") {
                        row["Product/Service Tax Amount"] = 0;
                }
                if (!row["Product/Service Tax Code"]) {
                        row["Product/Service Tax Code"] = "Out Of Scope";
                        row["Product/Service Tax Amount"] = 0;
                }
                if (row["Product/Service Quantity"] === undefined || row["Product/Service Quantity"] === "") {
                        row["Product/Service Quantity"] = 1;
                }

                row["Global Tax Calculation"] = "TaxExcluded";

                return row;
        });
}

// 🟩 Upload Controller
export async function uploadEstimates(req, res) {
        if (!req.file) return res.status(400).send("No file uploaded");
        try {
                await move(req.file.path, excelFilePath, { overwrite: true });
                console.log("✅Australia Estimates file saved at:", excelFilePath);
                res.send({ message: "File uploaded and saved successfully" });
        } catch (err) {
                console.error("❌ File move error:", err.message);
                res.status(500).send("Error saving file");
        }
}

// ⚙️ Process Controller
export async function processEstimates(req, res) {
        try {
                let jsonData = await readExcelToJson(excelFilePath);

                jsonData = renameColumns(jsonData, changeColumnName);
                jsonData = addDepositNumber(jsonData);
                jsonData = filterColumns(jsonData);
                jsonData = processData(jsonData);

                await saveJsonToFile(jsonData, outputJsonPath);
                const numberFields = ["Expense Account Tax Amount", "Exchange Rate", "Expense Line Amount"];
                const dateFields = ["Estimate Date", "Expiration Date", "Accepted Date"]
                await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

                console.log("✅Australia Estimates Excel processed.");
                res.send("Excel processed successfully with all business rules applied.");
        } catch (error) {
                console.error("❌ Error processing Excel:", error.message);
                res.status(500).send("Error processing Excel file.");
        }
}

// 📥 Download Controller
export async function downloadEstimates(req, res) {
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

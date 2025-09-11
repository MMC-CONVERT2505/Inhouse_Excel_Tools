import { move, pathExists } from "fs-extra";
import { readExcelToJson } from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "purchaseorder";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
        "TxnID": "TxnID",
        "DocNumber": "DocNumber",
        "VendorRefFullName": "Vendor",
        "POStatus": "Purchase Order Status",
        "TxnDate": "Purchase Order Date",
        "DueDate": "Due Date",
        "PrivateNote": "Memo",
        "GlobalTaxCalculation": "Global Tax Calculation",
        "PurchaseOrderLineAccountRefFullName": "Expense Account",
        "PurchaseOrderLineMemo": "Expense Description",
        "PurchaseOrderLineAmount": "Expense Line Amount",
        "PurchaseOrderLineCustomerRefFullName": "Expense Customer",
        "PurchaseOrderLineClassRefFullName": "Expense Class",
        "PurchaseOrderLineTaxCodeRefFullName": "Expense Tax Code",
        "PurchaseOrderLineItemRefFullName": "Product/Service",
        "PurchaseOrderLineMemo": "Product/Service Description",
        "PurchaseOrderLineQty": "Product/Service Quantity",
        "PurchaseOrderLineUnitPrice": "Product/Service Rate",
        "PurchaseOrderLineAmount": "Product/Service Amount",
        "ClassRefFullName": "Product/Service Class",
        "CurrencyRefListID": "Currency Code",
        "ExchangeRate": "Exchange Rate",
        "CustomFieldPONumber": "CustomFieldPONumber",
        "SalesTermRefFullName": "Terms",
};

const allowedColumns = [
        "PO No",
        "Vendor",
        "Purchase Order Status",
        "Purchase Order Date",
        "Due Date",
        "Memo",
        "Global Tax Calculation",
        "Expense Account",
        "Expense Description",
        "Expense Line Amount",
        "Expense Customer",
        "Expense Class",
        "Expense Tax Code",
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
        "Terms",
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
                        row["PO No"] = `${txn}_${ref}`.replace(/^-|-$/g, "");
                } else {
                        row["PO No"] = txn;
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
                // if (row["Product/Service Tax Amount"] === undefined || row["Product/Service Tax Amount"] === "") {
                //         row["Product/Service Tax Amount"] = 0;
                // }
                if (!row["Product/Service Tax Code"]) {
                        row["Product/Service Tax Code"] = "Out Of Scope";
                        // row["Product/Service Tax Amount"] = 0;
                }
                if (row["Product/Service Quantity"] === undefined || row["Product/Service Quantity"] === "") {
                        row["Product/Service Quantity"] = 1;
                }

                row["Global Tax Calculation"] = "TaxExcluded";

                row["Expense Description"] = row["Product/Service Description"];

                row["Expense Line Amount"] = row["Product/Service Amount"];

                row["Expense Tax Code"] = row["Product/Service Tax Code"];

                return row;
        });
}

// 🟩 Upload Controller
export async function uploadPurchaseOrder(req, res) {
        if (!req.file) return res.status(400).send("No file uploaded");
        try {
                await move(req.file.path, excelFilePath, { overwrite: true });
                console.log("Australia Purchase Order file saved at:", excelFilePath);
                res.send({ message: "File uploaded and saved successfully" });
        } catch (err) {
                console.error("❌ File move error:", err.message);
                res.status(500).send("Error saving file");
        }
}

// ⚙️ Process Controller
export async function processPurchaseOrder(req, res) {
        try {
                let jsonData = await readExcelToJson(excelFilePath);

                jsonData = renameColumns(jsonData, changeColumnName);
                jsonData = addDepositNumber(jsonData);
                jsonData = filterColumns(jsonData);
                jsonData = processData(jsonData);

                await saveJsonToFile(jsonData, outputJsonPath);
                const numberFields = ["Expense Account Tax Amount", "Exchange Rate", "Expense Line Amount"];
                const dateFields = ["Purchase Order Date", "Due Date"]

                await writeJsonToExcel(jsonData, modifiedExcelPath, numberFields, dateFields);

                console.log("✅Australia Purchase Order Excel processed.");
                res.send("Excel processed successfully with all business rules applied.");
        } catch (error) {
                console.error("❌ Error processing Excel:", error.message);
                res.status(500).send("Error processing Excel file.");
        }
}

// 📥 Download Controller
export async function downloadPurchaseOrder(req, res) {
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

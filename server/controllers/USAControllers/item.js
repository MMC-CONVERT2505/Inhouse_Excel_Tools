import { move, pathExists } from "fs-extra";
import { readExcelToJson } from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "item";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const allowedColumns = [
    "Product/Service", "Type", "Description", "Price", "Cost", "Qty On Hand", "Sales Tax Code", "Purchases Tax Code", "SKU",
    "Taxable", "Income Account", "Class", "Purchase Description", "Expense Account", "Preferred Supplier", "Low Stock Alert",
    "Qty On PO", "Inventory asset account", "Quantity as of date"
];


// ✅ Upload file
export async function uploadItem(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");

    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("Global Items file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// 🚀 Process Excel logic
export async function processItem(req, res) {
    try {
        let jsonData = await readExcelToJson(excelFilePath);

        const processedData = jsonData.map((row) => {
            const originalType = row["Type"]?.trim();

            // Only modify if type is Inventory
            if (originalType?.toLowerCase() === "inventory" || originalType?.toLowerCase() === "non-inventory" || originalType?.toLowerCase() === "stock") {
                row["Type"] = "NonInventory";
            }

            // Preserve Service type
            if (originalType?.toLowerCase() === "service") {
                row["Type"] = "Service";
            }

            return row;
        });

        const finalData = processedData.map(row => {
            const filteredRow = {};

            for (const key of allowedColumns) {
                filteredRow[key] = row.hasOwnProperty(key) ? row[key] : "";
            }

            return filteredRow;
        });

        await saveJsonToFile(finalData, outputJsonPath);
        await writeJsonToExcel(finalData, modifiedExcelPath);

        console.log("Global Items Excel processed.");
        res.send("Excel processed and saved with selected columns.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Download final Excel
export async function downloadItem(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);

        if (exists) {
            res.download(modifiedExcelPath, "modifiedItems.xlsx", (err) => {
                if (err) {
                    console.error("❌ Download error:", err.message);
                } else {
                    console.log("✅Item Excel file downloaded.");
                }
            });
        } else {
            res.status(404).send("Modified Excel file not found. Please process it first.");
        }
    } catch (err) {
        console.error("❌ File check error:", err.message);
        res.status(500).send("Error checking or downloading the file.");
    }
}

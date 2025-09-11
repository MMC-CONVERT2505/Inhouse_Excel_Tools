import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";
import validator from "validator";
const { isEmail } = validator;

const type = "supplier";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const allowedColumns = [
    "Display Name As", "Title", "First Name", "Middle Name", "Last Name", "Company", "Billing Address Line 1", "Billing Address Line 2",
    "Billing Address City", "Billing Address Country Subdivision Code", "Billing Address Postal Code", "Billing Address Country", "Notes",
    "Email", "Phone", "Mobile", "Fax", "Other", "Website", "Account No", "Terms", "Opening Balance", "Tax ID", "Currency Code",
];

const mapType = (qboType) => {
    const map = {
        "Supplier/Vendor": "Display Name As",
        "Supplier": "Display Name As",
        "Vendor": "Display Name As",
        "Title": "Title",
        "First Name": "First Name",
        "Middle Name": "Middle Name",
        "Last Name": "Last Name",
        "Company Name": "Company",
        "Address": "Billing Address Line 1",
        "Street": "Billing Address Line 2",
        "City": "Billing Address City",
        "State": "Billing Address Country Subdivision Code",
        "ZIP": "Billing Address Postal Code",
        "Country": "Billing Address Country",
        "Note": "Notes",
        "Email": "Email",
        "Phone Numbers": "Phone",
        "Mobile": "Mobile",
        "Fax": "Fax",
        "Other": "Other",
        "Website": "Website",
        "Account No.": "Account No",
        "Terms": "Terms",
        "Balance": "Opening Balance",
        "Tax ID": "Tax ID",
        "Currency": "Currency Code",
    };
    return map[qboType] || null;
};

// 🔄 Step 1: Map keys to allowed columns
const remapColumns = (row) => {
    const newRow = {};
    for (const key in row) {
        const mappedKey = mapType(key);
        if (mappedKey) {
            // If the mappedKey already exists (e.g., multiple fields mapping to "Display Name As"), prefer existing or append if needed.
            if (!newRow[mappedKey]) {
                newRow[mappedKey] = row[key];
            }
        }
    }

    // Special handling: If "Display Name As" is missing but "Supplier" or "Vendor" exists
    if (!newRow["Display Name As"] && (row["Supplier"] || row["Vendor"])) {
        newRow["Display Name As"] = row["Supplier"] || row["Vendor"];
    }

    return newRow;
};

// 🔧 Step 2: Filter only allowed columns and validate email
const filterColumns = (data) => {
    return data.map(originalRow => {
        const mappedRow = remapColumns(originalRow);
        const filteredRow = {};

        // Handle multiple emails safely
        if (mappedRow.Email) {
            const emails = String(mappedRow.Email)
                .split(/[,; ]+/)
                .map(e => e.trim())
                .filter(e => e);

            const validEmail = emails.find(email => typeof email === 'string' && isEmail(email));

            if (validEmail) {
                mappedRow.Email = validEmail;
            } else {
                console.log(`❌ Invalid email(s) for entry "${mappedRow["Display Name As"] || "Unknown"}": [${emails.join(', ')}] - No valid email found.`);
                mappedRow.Email = '';
            }
        }

        // Keep only allowed columns
        for (const key of allowedColumns) {
            if (mappedRow.hasOwnProperty(key)) {
                filteredRow[key] = mappedRow[key];
            }
        }

        return filteredRow;
    });
};

// ✅ Upload: move file to correct location
export async function uploadSupplier(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");

    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅ USA Supplier file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// 🚀 Controller: Process Excel and export filtered + modified data
export async function processSupplier(req, res) {
    try {
        const jsonData = await readExcelToJson(excelFilePath);
        const filteredData = filterColumns(jsonData);

        await saveJsonToFile(filteredData, outputJsonPath);
        await writeJsonToExcel(filteredData, modifiedExcelPath);

        console.log("✅ USA Supplier Excel processed.");
        res.send("Excel processed and saved with selected columns and valid emails.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Controller: Download modified Excel
export async function downloadSupplier(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);

        if (exists) {
            res.download(modifiedExcelPath, "modifiedSupplier.xlsx", (err) => {
                if (err) {
                    console.error("❌ Download error:", err.message);
                } else {
                    console.log("✅ Excel file downloaded.");
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

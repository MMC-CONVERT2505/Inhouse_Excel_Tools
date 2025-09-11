import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";
import validator from "validator";
const { isEmail } = validator;

const type = "supplier";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const allowedColumns = [
  "Supplier", "Phone Numbers", "Email", "Full Name", "Address", "Account No.", "Phone", "Company Name", "Website", "Other", "Terms",
  "ABN", "Note", "Street", "City", "State/Territory", "Postcode", "Country", "Last Name", "First Name", "Billing Street", "Billing City",
  "Billing State/Territory", "Billing postcode", "Billing Country"
];

// 🔧 Helper: Filter only allowed columns and validate email

const filterColumns = (data) => {
  return data.map(row => {
    const filteredRow = {};

    // Handle multiple emails safely
    if (row.Email) {
      const emails = String(row.Email) // Ensure it's a string
        .split(/[,; ]+/)
        .map(e => e.trim())
        .filter(e => e);

      const validEmail = emails.find(email => typeof email === 'string' && isEmail(email));

      if (validEmail) {
        row.Email = validEmail;
      } else {
        console.log(`❌ Invalid email(s) for customer "${row.Customer}": [${emails.join(', ')}] - No valid email found.`);
        row.Email = '';
      }
    }

    // Keep only allowed columns
    for (const key of allowedColumns) {
      if (row.hasOwnProperty(key)) {
        filteredRow[key] = row[key];
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
    console.log("✅Australia Supplier file saved at:", excelFilePath);
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

    console.log("✅Australia Supplier Excel processed.");
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

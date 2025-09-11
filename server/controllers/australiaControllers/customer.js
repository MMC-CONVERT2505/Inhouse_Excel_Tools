import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";
import validator from "validator";
const { isEmail } = validator;

const type = "customer";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const allowedColumns = [
  "Customer", "Phone Numbers", "Email", "Full Name", "Billing Address", "Shipping Address", "Phone", "Company Name",
  "Website", "Delivery Method", "Other", "Taxable", "Credit Card No.", "CC Expires", "Payment Method", "Terms",
  "Customer Type", "Note", "Billing Street", "Billing City", "Billing State/Territory", "Billing postcode", "Billing Country",
  "Shipping Street", "Shipping City", "Shipping State/Territory", "Shipping Postcode", "Shipping Country",
  "Last Name", "First Name", "Currency"
];

// ✅ Filter and validate
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
export async function uploadCustomer(req, res) {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    await move(req.file.path, excelFilePath, { overwrite: true });
    console.log("✅Australia Customer file saved at:", excelFilePath);
    res.send({ message: "File uploaded and saved successfully" });
  } catch (err) {
    console.error("❌ File move error:", err.message);
    res.status(500).send("Error saving file");
  }
}

// ✅ Convert
export async function processCustomer(req, res) {
  try {
    const jsonData = await readExcelToJson(excelFilePath);
    const filteredData = filterColumns(jsonData);

    await saveJsonToFile(filteredData, outputJsonPath);
    await writeJsonToExcel(filteredData, modifiedExcelPath);

    console.log("✅Australia Customer Excel processed.");
    res.send("Customer data processed and saved.");
  } catch (error) {
    console.error("❌ Error processing Customer:", error.message);
    res.status(500).send("Error processing Excel file.");
  }
}

// ✅ Download
export async function downloadCustomer(req, res) {
  try {
    const fileExists = await pathExists(modifiedExcelPath);
    if (fileExists) {
      res.download(modifiedExcelPath, "modifiedCustomer.xlsx", (err) => {
        if (err) console.error("❌ Download error:", err.message);
      });
    } else {
      res.status(404).send("Modified file not found. Process the file first.");
    }
  } catch (error) {
    console.error("❌ File check error:", error.message);
    res.status(500).send("Error checking or downloading file.");
  }
}

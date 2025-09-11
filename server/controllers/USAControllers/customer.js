import { move, pathExists } from "fs-extra";
import { readExcelToJson } from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import validator from "validator";
const { isEmail } = validator;
import { getPaths } from "../../utils/filePaths.js";

const type = "customer";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const allowedColumns = [
  "Title",
  "Company",
  "First Name",
  "Middle Name",
  "Last Name",
  "Suffix",
  "Display Name As",
  "Print On Check As",
  "Billing Address Line 1",
  "Billing Address Line 2",
  "Billing Address Line 3",
  "Billing Address City",
  "Billing Address Postal Code",
  "Billing Address Country",
  "Billing Address Country Subdivision Code",
  "Shipping Address Line 1",
  "Shipping Address Line 2",
  "Shipping Address Line 3",
  "Shipping Address City",
  "Shipping Address Postal Code",
  "Shipping Address Country",
  "Shipping Address Country Subdivision Code",
  "Phone",
  "Mobile",
  "Fax",
  "Other",
  "Website",
  "Email",
  "Terms",
  "Preferred Payment Method",
  "Tax Resale No",
  "Preferred Delivery Method",
  "Notes",
  "Customer Taxable",
  "Currency Code"
];

const mapType = (qboType) => {
  const map = {
    "Title": "Title",
    "Company Name": "Company",
    "First Name": "First Name",
    "Middle Name": "Middle Name",
    "Last Name": "Last Name",
    "Suffix": "Suffix",
    "Customer": "Display Name As",
    "Print On Check As": "Print On Check As",
    "Billing Address": "Billing Address Line 1",
    "Billing Street": "Billing Address Line 2",
    "Billing Address Line 3": "Billing Address Line 3",
    "Billing City": "Billing Address City",
    "Billing ZIP": "Billing Address Postal Code",
    "Billing Country": "Billing Address Country",
    "Billing State": "Billing Address Country Subdivision Code",
    "Shipping Address": "Shipping Address Line 1",
    "Shipping Street": "Shipping Address Line 2",
    "Shipping Address Line 3": "Shipping Address Line 3",
    "Shipping City": "Shipping Address City",
    "Shipping ZIP": "Shipping Address Postal Code",
    "Shipping Country": "Shipping Address Country",
    "Shipping State": "Shipping Address Country Subdivision Code",
    "Phone": "Phone",
    "Mobile": "Mobile",
    "Fax": "Fax",
    "Other": "Other",
    "Website": "Website",
    "Email": "Email",
    "Terms": "Terms",
    "Payment Method": "Preferred Payment Method",
    "Tax Resale No": "Tax Resale No",
    "Delivery Method": "Preferred Delivery Method",
    "Note": "Notes",
    "Taxable": "Customer Taxable",
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
export async function uploadCustomer(req, res) {
  if (!req.file) return res.status(400).send("No file uploaded");

  try {
    await move(req.file.path, excelFilePath, { overwrite: true });
    console.log("✅ USA customer file saved at:", excelFilePath);
    res.send({ message: "File uploaded and saved successfully" });
  } catch (err) {
    console.error("❌ File move error:", err.message);
    res.status(500).send("Error saving file");
  }
}

// 🚀 Controller: Process Excel and export filtered + modified data
export async function processCustomer(req, res) {
  try {
    const jsonData = await readExcelToJson(excelFilePath);
    const filteredData = filterColumns(jsonData);

    await saveJsonToFile(filteredData, outputJsonPath);
    await writeJsonToExcel(filteredData, modifiedExcelPath);

    console.log("✅ USA customer Excel processed.");
    res.send("Excel processed and saved with selected columns and valid emails.");
  } catch (error) {
    console.error("❌ Error processing Excel:", error.message);
    res.status(500).send("Error processing Excel file.");
  }
}

// 📥 Controller: Download modified Excel
export async function downloadCustomer(req, res) {
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

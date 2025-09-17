import { move, pathExists } from "fs-extra";
import { readExcelToJson } from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";
import validator from "validator";
const { isEmail } = validator;

const type = "customer";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const changeColumnName = {
  "Company Name": "Company",
  "First Name": "First Name",
  "Last Name": "Last Name",
  "Customer": "Display Name As",
  "Billing Address": "Billing Address Line 1",
  "Billing Street": "Billing Address Line 2",
  "Billing City": "Billing Address City",
  "Billing postal code": "Billing Address Postal Code",
  "Billing Country": "Billing Address Country",
  "Billing County": "Billing Address Country Subdivision Code",
  "Shipping Address": "Shipping Address Line 1",
  "Shipping Street": "Shipping Address Line 2",
  "Shipping City": "Shipping Address City",
  "Shipping Postal code": "Shipping Address Postal Code",
  "Shipping Country": "Shipping Address Country",
  "Shipping Province/Region/State": "Shipping Address Country Subdivision Code",
  "Phone Numbers": "Phone",
  "Mobile": "Mobile",
  "Fax": "Fax",
  "Other": "Other",
  "Website": "Website",
  "Email": "Email",
  "Terms": "Terms",
  "Payment Method": "Preferred Payment Method",
  "VAT Registration No. of Customer": "Tax Resale No",
  "Delivery Method": "Preferred Delivery Method",
  "Notes": "Notes",
  "Customer Type": "Customer Taxable",
  "Currency": "Currency Code"
}
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

// ✅ Upload: move file to correct location
export async function uploadCustomer(req, res) {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    await move(req.file.path, excelFilePath, { overwrite: true });
    console.log("✅ Africa Customer file saved at:", excelFilePath);
    res.send({ message: "File uploaded and saved successfully" });
  } catch (err) {
    console.error("❌ File move error:", err.message);
    res.status(500).send("Error saving file");
  }
}

// ✅ Convert
export async function processCustomer(req, res) {
  try {
    let jsonData = await readExcelToJson(excelFilePath);
    jsonData = renameColumns(jsonData);
    const filteredData = filterColumns(jsonData);

    await saveJsonToFile(filteredData, outputJsonPath);
    await writeJsonToExcel(filteredData, modifiedExcelPath);

    console.log("✅ Africa Customer Excel processed.");
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

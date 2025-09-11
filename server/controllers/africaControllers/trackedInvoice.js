import { pathExists } from "fs-extra";
import xlsx from "xlsx";
import { saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";

const type = "trackedinvoice";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

// Column Rename Map
const changeColumnName = {
  "Num": "Invoice No",
  "Name": "Customer",
  "Date": "Invoice Date",
  "Due Date": "Due Date",
  "Service Date": "Service Date",
  "Product/Service": "Product/Service",
  "Memo/Description": "Product/Service Description",
  "Qty": "Product/Service Quantity",
  "Rate": "Product/Service Rate",
  "Tax Code": "Product/Service Tax Code",
  "GST": "Product/Service Tax Amount",
  "Class": "Product/Service Class",
  "Customer memo": "Note to customer",
  "Memo": "Memo on statement", "SKU": "SKU",
  "Term": "Terms",
  "Discount": "Discount Percent",
  "Currency": "Currency Code",
  "Exchange Rate": "Exchange Rate",
  "Debit": "Debit",
  "Credit": "Credit",
  "Account": "Account",
  "Unit Price/Rate": "Unit Price/Rate"
};

// Allowed Columns
const allowedColumns = [
  "Invoice No", "Customer", "Invoice Date", "Due Date", "Global Tax Calculation", "Service Date",
  "Product/Service", "Product/Service Description", "Product/Service Quantity", "Product/Service Rate",
  "Product/Service Amount", "Product/Service Tax Code", "Product/Service Tax Amount", "Product/Service Class",
  "Note to customer", "Memo on statement", "SKU", "Terms", "Discount Percent", "Currency Code",
  "Exchange Rate", "Account Type", "GST Code", "Account Description"
];

const journalColumns = {
  "Invoice No": "Journal No",
  "Invoice Date": "Journal Date",
  "Product/Service Description": "Memo",
  "Account": "Account",
  Debit: "Debit",
  Credit: "Credit",
  "Description": "Description",
  "Customer": "Name",
  "Class": "Class"
}

const journalAllowedColumns = [
  "Journal No", "Journal Date", "Memo", "Account", "Debit", "Credit", "Description", "Name", "Class"
];

// Utility functions
const renameColumns = (data, map) => data.map(row => {
  const newRow = {};
  for (const key in row) newRow[map[key] || key] = row[key];
  return newRow;
});

const fillDownDueDate = data => {
  let last = "";
  return data.map(row => {
    if (row["Due Date"]) last = row["Due Date"];
    else row["Due Date"] = last;
    return row;
  });
};

const processInvoiceData = data => data.map(row => {
  row["Product/Service Quantity"] = (row["Product/Service Quantity"] || "1").toString().replace("-", "");
  row["Product/Service Tax Code"] ??= "Out Of Scope";
  row["Product/Service Tax Amount"] ??= 0;

  const debit = parseFloat(row["Debit"] || 0);
  const credit = parseFloat(row["Credit"] || 0);
  const amount = +(credit - debit).toFixed(2);
  const quantity = parseFloat(row["Product/Service Quantity"]) || 1;
  const rate = quantity !== 0 ? +(amount / quantity).toFixed(2) : 0;

  row["Product/Service Amount"] = amount;
  row["Product/Service Rate"] = rate;
  row["Global Tax Calculation"] = "TaxExcluded";
  return row;
});

const removeInvalidRows = data => data.filter(row => {
  const account = (row["Account"] || "").toLowerCase();
  return !account.includes("receivable") && !account.includes("payable");
});

const normalizeInvoiceNumbers = data => data.map(row => {
  row["Invoice No"] = (row["Invoice No"] || "").toString().trim().slice(0, 21);
  return row;
});

const filterColumns = data => data.map(row => {
  const filtered = {};
  for (const key of allowedColumns) filtered[key] = row[key] ?? "";
  return filtered;
});

const sortByInvoiceNo = data =>
  data.sort((a, b) => (a["Invoice No"] || "").localeCompare(b["Invoice No"] || ""));

// Upload Controller
export async function uploadTrackedInvoice(req, res) {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).send("Please upload both Invoice and COA files.");
    }

    const invoiceFile = req.files[0].path;
    const coaFile = req.files[1].path;

    const invoiceWb = xlsx.readFile(invoiceFile);
    const coaWb = xlsx.readFile(coaFile);

    const invoiceSheet = invoiceWb.Sheets[invoiceWb.SheetNames[0]];
    const itemSheet = coaWb.Sheets[coaWb.SheetNames[0]];

    const newWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWb, invoiceSheet, "Invoice");
    xlsx.utils.book_append_sheet(newWb, itemSheet, "Item");
    xlsx.writeFile(newWb, excelFilePath);

    console.log("✅ Invoice and COA merged and saved:", excelFilePath);
    res.send({ message: "Files uploaded and merged. Ready to process." });
  } catch (err) {
    console.error("❌ Upload error:", err.message);
    res.status(500).send("File upload failed.");
  }
}

// Process Controller
// Process Controller
export async function processTrackedInvoice(req, res) {
  try {
    const workbook = xlsx.readFile(excelFilePath);
    const invoiceSheet = workbook.Sheets["Invoice"];
    const itemSheet = workbook.Sheets["Item"];

    if (!invoiceSheet) return res.status(400).send("Invoice sheet missing.");
    if (!itemSheet) return res.status(400).send("Item sheet missing.");

    let invoiceData = xlsx.utils.sheet_to_json(invoiceSheet);
    const itemData = xlsx.utils.sheet_to_json(itemSheet);

    // Get inventory services from item sheet
    const inventoryServices = new Set(
      itemData
        .filter(item => (item["Type"] || "").toLowerCase() === "inventory")
        .map(item => item["Product/Service"])
    );

    // Step 1: Rename and Process Invoice
    invoiceData = renameColumns(invoiceData, changeColumnName);
    invoiceData = fillDownDueDate(invoiceData);
    invoiceData = processInvoiceData(invoiceData);

    // Step 2: Separate removed inventory rows
    const removedItems = [];
    invoiceData = invoiceData.filter(row => {
      if (inventoryServices.has(row["Product/Service"])) {
        removedItems.push({ ...row }); // Clone before mutation
        return false;
      }
      return true;
    });

    // Step 3: Finalize valid invoice data
    invoiceData = removeInvalidRows(invoiceData);
    invoiceData = normalizeInvoiceNumbers(invoiceData);
    invoiceData = sortByInvoiceNo(invoiceData);
    invoiceData = filterColumns(invoiceData);

    // Step 4: Prepare removed data in journal format
    // Step 4: Prepare removed data in journal format
    const renamedRemoved = renameColumns(removedItems, journalColumns);
    const filteredRemoved = renamedRemoved.map(row => {
      const filtered = {};
      for (const key of journalAllowedColumns) {
        // Assign Description same as Memo if not already present
        if (key === "Description") {
          filtered[key] = row["Memo"] || "";
        } else {
          filtered[key] = row[key] ?? "";
        }
      }
      return filtered;
    });


    // Step 5: Save both sheets to one Excel file
    const wb = xlsx.utils.book_new();
    const finalSheet = xlsx.utils.json_to_sheet(invoiceData);
    const removedSheet = xlsx.utils.json_to_sheet(filteredRemoved);

    xlsx.utils.book_append_sheet(wb, finalSheet, "Final Invoice");
    xlsx.utils.book_append_sheet(wb, removedSheet, "Journal");
    xlsx.writeFile(wb, modifiedExcelPath);

    // Also save JSON for debugging/logging if needed
    await saveJsonToFile(invoiceData, outputJsonPath);

    console.log(`✅ Processed: ${invoiceData.length} | Removed: ${filteredRemoved.length}`);
    res.send({
      message: "Invoice processed with removed Inventory entries.",
      totalRows: invoiceData.length,
      removedRows: filteredRemoved.length,
      file: modifiedExcelPath
    });
  } catch (err) {
    console.error("❌ Processing error:", err.message);
    res.status(500).send("Processing failed.");
  }
}


// Download Controller
export async function downloadTrackedInvoice(req, res) {
  try {
    if (await pathExists(modifiedExcelPath)) {
      res.download(modifiedExcelPath, "Modified_TrackedInvoice.xlsx", err => {
        if (err) console.error("❌ Download error:", err.message);
        else console.log("✅ File sent to user.");
      });
    } else {
      res.status(404).send("Please process the file first.");
    }
  } catch (err) {
    console.error("❌ Download check error:", err.message);
    res.status(500).send("Download failed.");
  }
}

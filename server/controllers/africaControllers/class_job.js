import { move, pathExists } from "fs-extra";
import {readExcelToJson} from "../../utils/excelReader.js";
import { writeJsonToExcel, saveJsonToFile } from "../../utils/excelWriter.js";
import { getPaths } from "../../utils/filePaths.js";
import validator from "validator";
const { isEmail } = validator;

const type = "class";
const { excelFilePath, outputJsonPath, modifiedExcelPath } = getPaths(type);

const allowedColumns = ["Class"];

// 🔁 Rename map: original column ➝ new column name
const renameMap = {
    "Class": "Name"
};

// 🔧 Helper: Filter only allowed columns
const filterColumns = (data) => {
    return data
        .map(row => {
            const filteredRow = {};
            for (const key of allowedColumns) {
                const newKey =  renameMap[key] || key;
                if (row.hasOwnProperty(key)) {
                    filteredRow[newKey] = row[key];
                }
            }
            return filteredRow;
        });
};

// ✅ Upload: move file to correct location
export async function uploadClass(req, res) {
    if (!req.file) return res.status(400).send("No file uploaded");

    try {
        await move(req.file.path, excelFilePath, { overwrite: true });
        console.log("✅Australia Class file saved at:", excelFilePath);
        res.send({ message: "File uploaded and saved successfully" });
    } catch (err) {
        console.error("❌ File move error:", err.message);
        res.status(500).send("Error saving file");
    }
}

// 🚀 Controller: Process Excel and export filtered + modified data
export async function processClass(req, res) {
    try {
        const jsonData = await readExcelToJson(excelFilePath);
        const filteredData = filterColumns(jsonData);

        await saveJsonToFile(filteredData, outputJsonPath);
        await writeJsonToExcel(filteredData, modifiedExcelPath);

        console.log("✅Australia Class Excel processed.");
        res.send("Excel processed and saved with selected columns and valid Column Name.");
    } catch (error) {
        console.error("❌ Error processing Excel:", error.message);
        res.status(500).send("Error processing Excel file.");
    }
}

// 📥 Controller: Download modified Excel
export async function downloadClass(req, res) {
    try {
        const exists = await pathExists(modifiedExcelPath);

        if (exists) {
            res.download(modifiedExcelPath, "modifiedClass.xlsx", (err) => {
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

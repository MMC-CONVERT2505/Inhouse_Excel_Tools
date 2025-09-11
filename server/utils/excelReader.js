import { read, utils } from "xlsx";
import { promises as fs } from "fs";
import path from "path";

export const readExcelToJson = async (excelPath) => {
    try {
        const fileBuffer = await fs.readFile(excelPath);
        const workbook = read(fileBuffer, { type: "buffer" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = utils.sheet_to_json(worksheet);
        return jsonData;
    } catch (error) {
        throw new Error(`Failed to read Excel file: ${error.message}`);
    }
};


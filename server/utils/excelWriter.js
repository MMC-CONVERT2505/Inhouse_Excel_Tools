import { utils, writeFile } from "xlsx";
import pkg from 'fs-extra';
const { writeFile: _writeFile } = pkg;
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(customParseFormat);

function isExcelSerialDate(value) {
    return typeof value === "number" && value > 59 && value < 60000; // rough range: 1900–2064
}

function convertSerialToDate(serial) {
    const baseDate = new Date(Date.UTC(1899, 11, 30)); // Excel base date (with leap bug)
    baseDate.setUTCDate(baseDate.getUTCDate() + serial);
    return baseDate;
}

// export const writeJsonToExcel = async (jsonData, excelPath, numberFields = [], dateFields = []) => {
//     try {
//         const processedData = jsonData.map(row => {
//             const newRow = { ...row };

//             for (const field of dateFields) {
//                 const value = newRow[field];

//                 if (!value) continue;

//                 if (isExcelSerialDate(value)) {
//                     newRow[field] = convertSerialToDate(value); // ✅ handle Excel serial
//                 } else {
//                     const parsed = dayjs(value, ["DD/MM/YYYY", "D/M/YYYY", "DD-MM-YYYY", "YYYY-MM-DD"], true);
//                     if (parsed.isValid()) {
//                         newRow[field] = parsed.toDate();
//                     } else {
//                         console.warn(`⚠️ Invalid date: "${value}"`);
//                         newRow[field] = ""; // or keep value as-is
//                     }
//                 }
//             }

//             for (const field of numberFields) {
//                 if (newRow[field] !== undefined && newRow[field] !== null) {
//                     const num = parseFloat(newRow[field]);
//                     if (!isNaN(num)) {
//                         newRow[field] = num;
//                     }
//                 }
//             }

//             return newRow;
//         });

//         const worksheet = utils.json_to_sheet(processedData, { cellDates: true });
//         const workbook = utils.book_new();
//         utils.book_append_sheet(workbook, worksheet, "ModifiedSheet");

//         const range = utils.decode_range(worksheet['!ref']);
//         for (let C = range.s.c; C <= range.e.c; ++C) {
//             const header = worksheet[utils.encode_col(C) + "1"]?.v;
//             if (dateFields.includes(header)) {
//                 for (let R = 2; R <= range.e.r + 1; ++R) {
//                     const cellRef = utils.encode_cell({ c: C, r: R - 1 });
//                     const cell = worksheet[cellRef];
//                     if (cell && cell.v instanceof Date) {
//                         cell.t = 'd';
//                     }
//                 }
//             }
//         }

//         await new Promise((resolve, reject) => {
//             try {
//                 writeFile(workbook, excelPath);
//                 resolve();
//             } catch (error) {
//                 reject(error);
//             }
//         });

//         console.log("✅ Excel written successfully with proper date and number formatting.");
//     } catch (err) {
//         console.error("❌ Error writing Excel file:", err);
//         throw err;
//     }
// };

export const writeJsonToExcel = async (jsonData, excelPath, numberFields = [], dateFields = []) => {
    try {
        const processedData = jsonData.map(row => {
            const newRow = { ...row };

            for (const field of dateFields) {
                const value = newRow[field];

                if (!value) continue;

                if (isExcelSerialDate(value)) {
                    let d = convertSerialToDate(value);
                    d.setHours(0, 0, 0, 0);   // ✅ sirf date, no time
                    newRow[field] = dayjs(d).format("DD/MM/YYYY"); 
                } else {
                    const parsed = dayjs(value, ["DD/MM/YYYY", "D/M/YYYY", "DD-MM-YYYY", "YYYY-MM-DD"], true);
                    if (parsed.isValid()) {
                        newRow[field] = parsed.format("DD/MM/YYYY");  // ✅ string, no time ever
                    } else {
                        console.warn(`⚠️ Invalid date: "${value}"`);
                        newRow[field] = ""; // or keep value as-is
                    }
                }
            }

            for (const field of numberFields) {
                if (newRow[field] !== undefined && newRow[field] !== null) {
                    const num = parseFloat(newRow[field]);
                    if (!isNaN(num)) {
                        newRow[field] = num;
                    }
                }
            }

            return newRow;
        });

        const worksheet = utils.json_to_sheet(processedData, { cellDates: true });
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "ModifiedSheet");

        const range = utils.decode_range(worksheet['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const header = worksheet[utils.encode_col(C) + "1"]?.v;
            if (dateFields.includes(header)) {
                for (let R = 2; R <= range.e.r + 1; ++R) {
                    const cellRef = utils.encode_cell({ c: C, r: R - 1 });
                    const cell = worksheet[cellRef];
                    if (cell && cell.v instanceof Date) {
                        cell.t = 'd';
                        cell.z = "dd/mm/yyyy";  // ✅ only date, no time
                    }
                }
            }
        }

        await new Promise((resolve, reject) => {
            try {
                writeFile(workbook, excelPath);
                resolve();
            } catch (error) {
                reject(error);
            }
        });

        console.log("✅ Excel written successfully with proper date and number formatting.");
    } catch (err) {
        console.error("❌ Error writing Excel file:", err);
        throw err;
    }
};


export const saveJsonToFile = async (jsonData, jsonPath) => {
    try {
        await _writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
    } catch (err) {
        console.error("Error saving JSON file:", err);
        throw err;
    }
};
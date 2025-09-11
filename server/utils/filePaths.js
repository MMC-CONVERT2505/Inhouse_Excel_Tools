import { join } from "path";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export const getPaths = (type) => {
  const basePath = join(__dirname, `../data/${type}`);
  const paths = {
    excelFilePath: join(basePath, `QBO-${capitalize(type)}.xlsx`),
    outputJsonPath: join(basePath, `${type}Output.json`),
    modifiedExcelPath: join(basePath, `modified${capitalize(type)}.xlsx`),
  };
  return paths;
};
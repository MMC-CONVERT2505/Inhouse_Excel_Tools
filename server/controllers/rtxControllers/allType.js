import { existsSync, readdirSync, unlinkSync, mkdirSync, writeFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { readFile, utils } from 'xlsx';
import archiver from 'archiver';

const { DOWNLOAD_DIR = 'conversions/downloads' } = process.env;

// In-memory store for uploaded Excel file path
let uploadedAllTypesFilePath = '';

// Upload handler — stores uploaded Excel file path
const uploadAllTypes = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  uploadedAllTypesFilePath = req.file.path;
  console.log('Uploaded All Types Excel file:', uploadedAllTypesFilePath);
  res.json({ message: 'All Types Excel file uploaded successfully.' });
};

// Convert handler — read Excel, create CSVs per sheet, zip, and return download link
const convertAllTypes = async (req, res) => {
  if (!uploadedAllTypesFilePath || !existsSync(uploadedAllTypesFilePath)) {
    return res.status(400).json({ error: 'Uploaded file not found. Please upload first.' });
  }

  try {
    const workbook = readFile(uploadedAllTypesFilePath);
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const jsonData = utils.sheet_to_json(sheet);

    if (!jsonData.length) {
      return res.status(400).json({ error: 'Sheet is empty.' });
    }

    // Group rows by Type
    const groupedByType = {};

    jsonData.forEach(row => {
      const typeRaw = row['Type'] || 'Unknown';
      const type = typeRaw.toString().trim().toLowerCase().replace(/[^a-z0-9]/gi, '_');

      if (!groupedByType[type]) groupedByType[type] = [];
      groupedByType[type].push(row);
    });

    // Prepare converted directory
    const convertedDir = join(process.cwd(), DOWNLOAD_DIR, 'alltypes_temp');
    if (existsSync(convertedDir)) {
      readdirSync(convertedDir).forEach(f => unlinkSync(join(convertedDir, f)));
    } else {
      mkdirSync(convertedDir, { recursive: true });
    }

    const { Parser } = require('json2csv');

    for (const type in groupedByType) {
      const rows = groupedByType[type];
      const parser = new Parser();
      const csv = parser.parse(rows);
      const filePath = join(convertedDir, `${type}.csv`);
      writeFileSync(filePath, csv);
      console.log(`✅ Created CSV for Type: ${type}`);
    }

    // ZIP all CSVs
    const zipFileName = `alltypes_converted_${Date.now()}.zip`;
    const zipFilePath = join(process.cwd(), DOWNLOAD_DIR, zipFileName);

    const output = createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      return res.json({
        message: 'Conversion successful based on Type column.',
        downloadLink: `/download-alltypes/${zipFileName}`
      });
    });

    archive.on('error', err => {
      console.error('Archive error:', err);
      return res.status(500).json({ error: 'Failed to create ZIP archive.' });
    });

    archive.pipe(output);

    readdirSync(convertedDir).forEach(file => {
      archive.file(join(convertedDir, file), { name: file });
    });

    archive.finalize();

  } catch (err) {
    console.error('ConvertAllTypes error:', err);
    return res.status(500).json({ error: 'Conversion failed.' });
  }
};

// Download handler
const downloadAllTypes = (req, res) => {
  const fileName = req.params.filename;
  const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  res.download(filePath, fileName, err => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Download failed.' });
    }
  });
};

export default {
  uploadAllTypes,
  convertAllTypes,
  downloadAllTypes
};

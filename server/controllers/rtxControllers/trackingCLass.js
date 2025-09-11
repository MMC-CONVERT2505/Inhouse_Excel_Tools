import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { resolve as _resolve, join } from 'path';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { DOWNLOAD_DIR } from '../../config/config.mjs';

// Mapping
const reckonToXeroTrackingMapping = {
  '!CLASS': 'TrackingCategoryName',
  'NAME': 'Category Option',
};

const allowedTrackingColumns = ['TrackingCategoryName', 'Category Option'];

const cleanValue = (val) => {
  if (val === '*' || val === undefined || val === null || val.toString().trim() === '') {
    return '';
  }
  return val;
};

let uploadedTrackingFilePath = '';

// Upload handler
const uploadTracking = (req, res) => {
  uploadedTrackingFilePath = req.file.path;
  console.log("Uploaded Tracking File Path: ", uploadedTrackingFilePath);
  res.json({ message: 'Tracking Class file uploaded successfully.' });
};

// Convert handler
const convertTracking = async (req, res) => {
  try {
    if (!existsSync(uploadedTrackingFilePath)) {
      return res.status(400).json({ error: 'Uploaded tracking file not found.' });
    }

    const reckonRows = await parseCSV(uploadedTrackingFilePath);

    const convertedRows = reckonRows.map((reckonRow) => {
      let trackingType = cleanValue(reckonRow['!CLASS']).toLowerCase();
      trackingType = trackingType.charAt(0).toUpperCase() + trackingType.slice(1);
      const optionName = cleanValue(reckonRow['NAME']);

      return {
        'TrackingCategoryName': trackingType || 'Class',
        'Category Option': optionName
      };
    });

    const parser = new Parser({ fields: allowedTrackingColumns });
    const csvOutput = parser.parse(convertedRows);

    const outputDir = _resolve(process.cwd(), DOWNLOAD_DIR);
    mkdirSync(outputDir, { recursive: true });

    const fileName = 'converted_tracking.csv';
    const outputPath = join(outputDir, fileName);
    writeFileSync(outputPath, csvOutput);

    return res.json({
      message: 'Tracking data converted successfully.',
      downloadLink: `/download-tracking/${fileName}`,
      fileName
    });

  } catch (error) {
    console.error('Error during tracking conversion:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Download handler
const downloadTracking = (req, res) => {
  const fileName = req.params.filename;
  const filePath = join(process.cwd(), DOWNLOAD_DIR, fileName);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Download failed' });
    }
  });
};

// CSV parser utility
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export  {
  uploadTracking,
  convertTracking,
  downloadTracking
};

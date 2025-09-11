import mongoose from 'mongoose';

const individualSheetSchema = new mongoose.Schema({
  sheetName: { type: String, required: true },
  downloadedAt: { type: Date, default: Date.now }
});

const routeSheetGroupSchema = new mongoose.Schema({
  routeUsed: { type: String, required: true },
  sheets: [individualSheetSchema]
});

const fileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: String,
  softwareType: String,
  countryName: String,
  currencyStatus: {
    type: String,
    enum: ['Single Currency', 'Multi Currency'],
    required: true
  },
  status: {
    type: String,
    enum: ['running', 'completed'],
    default: 'running'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 60 * 60 * 24 * 30 } // auto-delete after 30 days
  },
  downloadedSheets: [routeSheetGroupSchema]
});

export default mongoose.model('File', fileSchema);


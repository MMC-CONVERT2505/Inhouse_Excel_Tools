//index.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/fileRoutes.js';
import ausRoutes from './routes/ausRoutes.js'; // Import Australia-specific Excel Routes For Single Currency
import ausMultiCurrencyRoutes from './routes/ausMultiCurrecnyRoutes.js'; // Import Australia-specific Excel Routes For Multi Currency
import USARoutes from './routes/USARoutes.js'; // Import Global Excel Routes For Single Currency
import USAMultiCurrencyRoutes from './routes/USAMultiCurrencyRoutes.js'; // Import Global Excel Routes For Multi Currency
import africaRoutes from './routes/africaRoutes.js'; // Import Global Excel Routes For Single Currency
import africaMultiCurrencyRoutes from './routes/africaMultiCurrencyRoutes.js'; // Import Global Excel Routes For Multi Currency
import fileRoutesSheet from './routes/fileRoutesSheet.js'; // Import file routes for saving downloaded sheets
import file from './routes/files.js';
import fileShowRoutes from './routes/fileShowRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { router } from './routes/rtxRoutes.js';
import xtxRoutes from './routes/xtxRoutes.js' ; 
import stqRoutes from './routes/stqRoutes.js';
import xtxMultiRoutes from './routes/xtxMultiRoutes.js';

// other setup ...

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.json()); // Parses incoming JSON

app.use('/api', userRoutes);
app.use('/api/files', fileShowRoutes);
app.use('/api', fileRoutesSheet);
app.use('/api/files', file);
// Routes
app.use('/api/auth', authRoutes);        // Authentication routes
app.use('/api/files', fileRoutes);       // File upload/download routes
// Excel processing routes For Australia Qbo to Qbo conversion 
app.use('/api/excel-australia-qbotoqbo/singlecurrency', ausRoutes);
app.use('/api/excel-australia-qbotoqbo/multicurrency', ausMultiCurrencyRoutes); 
// Excel processing routes For USA Qbo to Qbo conversion
app.use('/api/excel-usa-qbotoqbo/singlecurrency', USARoutes);  
app.use('/api/excel-usa-qbotoqbo/multicurrency', USAMultiCurrencyRoutes); 
// Excel processing routes For Africa Qbo to Qbo conversion
app.use('/api/excel-africa-qbotoqbo/singlecurrency', africaRoutes);  
app.use('/api/excel-africa-qbotoqbo/multicurrency', africaMultiCurrencyRoutes); 

// Import Australia-specific Excel Routes For Reckon Desktop to Xero conversion
app.use('/api/excel-australia-reckondesktoptoxero/singlecurrency',router);

 // Import Australia-specific Excel Routes For Xero to Xero conversion
app.use('/api/excel-australia-xerotoxero/singlecurrency', xtxRoutes);
app.use('/api/excel-australia-xerotoxero/multicurrency', xtxMultiRoutes);

 // Import Australia-specific Excel Routes For Sage one To Qbo conversion
app.use('/api/excel-australia-sageonetoqbo/singlecurrency', stqRoutes); 


import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static HTML page
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});


// MongoDB connection
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

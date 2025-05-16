import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { google } from 'googleapis';
import { join } from 'path';
import { writeFile, unlink, readFile } from 'fs/promises';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import { drive_v3 } from 'googleapis';
import { resolve } from 'path';
import { createReadStream } from 'fs';

// Load environment variables from the correct path
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Validate required environment variables
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_REFRESH_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  console.error('Please ensure .env file exists in the server directory with the following variables:');
  console.error(requiredEnvVars.join('\n'));
  process.exit(1);
}

const app = express();
const port = process.env['PORT'] || 3000;

// Configure CORS
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Initialize Google Drive API
const oauth2Client = new OAuth2Client(
  process.env['GOOGLE_CLIENT_ID'],
  process.env['GOOGLE_CLIENT_SECRET'],
  process.env['GOOGLE_REDIRECT_URI']
);

// Set credentials with refresh token
oauth2Client.setCredentials({
  refresh_token: process.env['GOOGLE_REFRESH_TOKEN']
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.ms-powerpoint' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      file.originalname.endsWith('.ppt') ||
      file.originalname.endsWith('.pptx')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PowerPoint files are allowed!'));
    }
  },
});

// Create uploads directory if it doesn't exist
import { mkdir } from 'fs/promises';
mkdir('uploads', { recursive: true }).catch(console.error);

// Convert endpoint
app.post('/api/convert', upload.single('file'), async (req, res) => {
  let uploadedFileId: string | null = null;
  let tempFilePath: string | null = null;
  let outputPath: string | null = null;

  try {
    console.log('Received conversion request');
    
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Read the uploaded file
    const filePath = req.file.path;
    tempFilePath = filePath;
    console.log('File read successfully');

    // Upload to Google Drive
    const fileMetadata: drive_v3.Schema$File = {
      name: req.file.originalname,
      mimeType: 'application/vnd.google-apps.presentation' // Convert to Google Slides format
    };

    const media = {
      mimeType: req.file.mimetype,
      body: createReadStream(filePath)
    };

    console.log('Uploading file to Google Drive...');
    try {
      const uploadedFile = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id'
      });

      if (!uploadedFile.data || !uploadedFile.data.id) {
        throw new Error('Failed to upload file to Google Drive');
      }

      uploadedFileId = uploadedFile.data.id;
      console.log('File uploaded and converted to Google Slides. File ID:', uploadedFileId);
    } catch (uploadError) {
      console.error('Error uploading to Google Drive:', uploadError);
      throw new Error(`Failed to upload to Google Drive: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
    }

    // Wait a moment for the conversion to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Export as PDF
    console.log('Converting to PDF...');
    try {
      const pdfResponse = await drive.files.export({
        fileId: uploadedFileId,
        mimeType: 'application/pdf'
      }, {
        responseType: 'arraybuffer'
      });

      // Generate output filename
      const outputFileName = req.file.originalname.replace(/\.(ppt|pptx)$/i, '.pdf');
      outputPath = join('uploads', outputFileName);

      // Save the PDF
      console.log('Saving PDF file...');
      const pdfBuffer = Buffer.from(pdfResponse.data as ArrayBuffer);
      await writeFile(outputPath, pdfBuffer);

      console.log('Conversion completed successfully');
      
      // Send the PDF file
      res.download(outputPath, outputFileName, async (err) => {
        if (err) {
          console.error('Error sending file:', err);
        }
        // Clean up files
        await cleanupFiles(uploadedFileId, tempFilePath, outputPath);
      });
    } catch (conversionError) {
      console.error('Error converting to PDF:', conversionError);
      throw new Error(`Failed to convert to PDF: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Conversion error:', error);
    // Clean up files in case of error
    await cleanupFiles(uploadedFileId, tempFilePath, outputPath);
    res.status(500).json({ 
      error: 'Error converting file to PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to clean up files
async function cleanupFiles(uploadedFileId: string | null, tempFilePath: string | null, outputPath: string | null) {
  try {
    // Delete from Google Drive
    if (uploadedFileId) {
      await drive.files.delete({
        fileId: uploadedFileId
      });
      console.log('Deleted file from Google Drive');
    }

    // Delete temporary files
    if (tempFilePath) {
      await unlink(tempFilePath);
      console.log('Deleted temporary upload file');
    }
    if (outputPath) {
      await unlink(outputPath);
      console.log('Deleted temporary PDF file');
    }
  } catch (cleanupError) {
    console.error('Error cleaning up files:', cleanupError);
  }
}

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 
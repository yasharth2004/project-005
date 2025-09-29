const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Test file processing
const testFileProcessing = async () => {
  try {
    await connectDB();
    
    // Get the File model
    const { File } = require('./dist/models/File');
    
    // Find the uploaded file
    const file = await File.findOne({ originalName: 'test-prism-info.txt' });
    
    if (!file) {
      console.log('❌ File not found in database');
      return;
    }
    
    console.log('📁 Found file:', {
      id: file._id,
      originalName: file.originalName,
      filename: file.filename,
      filePath: file.filePath,
      fileType: file.fileType,
      status: file.status
    });
    
    // Check if file exists on disk
    const fs = require('fs');
    const path = require('path');
    
    const absolutePath = path.resolve(file.filePath);
    console.log('🔍 Absolute file path:', absolutePath);
    
    if (fs.existsSync(absolutePath)) {
      console.log('✅ File exists on disk');
      
      // Try to read the file
      try {
        const content = fs.readFileSync(absolutePath, 'utf-8');
        console.log('📖 File content (first 200 chars):', content.substring(0, 200));
        console.log('📊 File size:', content.length, 'characters');
      } catch (readError) {
        console.log('❌ Error reading file:', readError.message);
      }
    } else {
      console.log('❌ File does not exist on disk');
      
      // Check what's in the uploads directory
      const uploadsDir = path.join(__dirname, 'uploads');
      console.log('📁 Uploads directory:', uploadsDir);
      
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        console.log('📋 Files in uploads directory:', files);
      } else {
        console.log('❌ Uploads directory does not exist');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the test
testFileProcessing();

// Utility to fix stuck files in processing state
// Run this script in the backend directory with: node fix-stuck-files.js

const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define File schema (simplified)
const fileSchema = new mongoose.Schema({
  originalName: String,
  status: String,
  uploadedAt: Date,
  updatedAt: Date,
});

const File = mongoose.model('File', fileSchema);

async function fixStuckFiles() {
  try {
    console.log('🔍 Looking for stuck files...');
    
    // Find files that have been processing for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const stuckFiles = await File.find({
      status: 'processing',
      updatedAt: { $lt: tenMinutesAgo }
    });
    
    console.log(`📁 Found ${stuckFiles.length} stuck files`);
    
    for (const file of stuckFiles) {
      console.log(`📝 Fixing file: ${file.originalName}`);
      
      // Update status to 'failed' so it can be deleted
      await File.findByIdAndUpdate(file._id, { 
        status: 'failed',
        updatedAt: new Date()
      });
      
      console.log(`✅ Updated ${file.originalName} status to 'failed'`);
    }
    
    console.log('🎉 All stuck files have been fixed!');
    console.log('💡 You can now delete the files from the admin dashboard.');
    
  } catch (error) {
    console.error('❌ Error fixing stuck files:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixStuckFiles();
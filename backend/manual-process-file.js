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

// Manually process a file
const manualProcessFile = async () => {
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
    
    // Try to read the file manually
    const fs = require('fs');
    
    try {
      console.log('🔍 Attempting to read file...');
      const content = fs.readFileSync(file.filePath, 'utf-8');
      console.log('✅ File read successfully');
      console.log('📊 Content length:', content.length);
      console.log('📖 First 200 chars:', content.substring(0, 200));
      
      // Try to process the text manually
      console.log('\n🔧 Processing text manually...');
      
      // Simple chunking
      const chunks = [];
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      let currentChunk = '';
      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;
        
        if (currentChunk.length + trimmedSentence.length > 800 && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = trimmedSentence;
        } else {
          currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      console.log(`✅ Created ${chunks.length} chunks`);
      chunks.forEach((chunk, index) => {
        console.log(`📄 Chunk ${index + 1}: ${chunk.length} chars`);
      });
      
      // Try to save to database
      console.log('\n💾 Attempting to save to database...');
      const { Document } = require('./dist/models/Document');
      
      const documents = chunks.map((chunk, index) => ({
        userId: null, // System file
        fileId: file._id,
        content: chunk,
        chunkIndex: index,
        metadata: {
          source: `uploaded file: ${file.originalName}`,
          fileName: file.originalName,
          tags: ['uploaded', file.fileType]
        }
      }));
      
      await Document.insertMany(documents);
      console.log('✅ Documents saved to database');
      
      // Update file status
      await File.findByIdAndUpdate(file._id, {
        status: 'completed',
        processedAt: new Date()
      });
      console.log('✅ File status updated to completed');
      
    } catch (readError) {
      console.log('❌ Error reading/processing file:', readError.message);
      console.log('❌ Error stack:', readError.stack);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the manual processing
manualProcessFile();

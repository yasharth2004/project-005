const mongoose = require('mongoose');
const { processAndSaveFile } = require('./dist/services/documentProcessor');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism';

async function forceProcessFiles() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all files that are not completed
    const db = mongoose.connection.db;
    const files = await db.collection('files').find({ 
      userId: null,
      status: { $ne: 'completed' }
    }).toArray();
    
    console.log(`📁 Found ${files.length} files to process\n`);
    
    if (files.length === 0) {
      console.log('✅ No files need processing');
      return;
    }
    
    // Process each file
    for (const file of files) {
      console.log(`🔄 Processing file: ${file.originalName}`);
      console.log(`   ID: ${file._id}`);
      console.log(`   Status: ${file.status}`);
      console.log(`   Type: ${file.fileType}`);
      
      try {
        await processAndSaveFile(file._id.toString());
        console.log(`✅ Successfully processed: ${file.originalName}\n`);
      } catch (error) {
        console.log(`❌ Failed to process: ${file.originalName}`);
        console.log(`   Error: ${error.message}\n`);
      }
    }
    
    // Check results
    console.log('📊 Final status check:');
    const updatedFiles = await db.collection('files').find({ userId: null }).toArray();
    updatedFiles.forEach(file => {
      console.log(`  ${file.originalName}: ${file.status}`);
    });
    
    const docsCount = await db.collection('documents').countDocuments({ userId: null });
    console.log(`\n📄 Total system documents created: ${docsCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

forceProcessFiles().catch(console.error);

const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism';

async function checkDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get collections info
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('📚 Collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    console.log('');

    // Check files
    const filesCount = await db.collection('files').countDocuments();
    const systemFilesCount = await db.collection('files').countDocuments({ userId: null });
    
    console.log('📁 Files Collection:');
    console.log(`  Total files: ${filesCount}`);
    console.log(`  System files: ${systemFilesCount}`);
    
    if (systemFilesCount > 0) {
      const systemFiles = await db.collection('files').find({ userId: null }).toArray();
      console.log('\n  System Files:');
      systemFiles.forEach((file, index) => {
        console.log(`    ${index + 1}. ${file.originalName} (${file.status})`);
        console.log(`       ID: ${file._id}`);
        console.log(`       Type: ${file.fileType}`);
        console.log(`       Path: ${file.filePath}`);
      });
    }
    console.log('');

    // Check documents
    const docsCount = await db.collection('documents').countDocuments();
    const systemDocsCount = await db.collection('documents').countDocuments({ userId: null });
    
    console.log('📄 Documents Collection:');
    console.log(`  Total documents: ${docsCount}`);
    console.log(`  System documents: ${systemDocsCount}`);
    
    if (systemDocsCount > 0) {
      const systemDocs = await db.collection('documents').find({ userId: null }).limit(3).toArray();
      console.log('\n  Sample System Documents:');
      systemDocs.forEach((doc, index) => {
        console.log(`    ${index + 1}. Chunk ${doc.chunkIndex}`);
        console.log(`       File ID: ${doc.fileId}`);
        console.log(`       Content: "${doc.content.substring(0, 100)}..."`);
        console.log(`       Tags: ${doc.metadata?.tags?.join(', ') || 'none'}`);
      });
    }
    
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

checkDatabase().catch(console.error);

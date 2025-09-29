const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism';

// Define schemas to check data
const fileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  originalName: String,
  filename: String,
  filePath: String,
  fileType: String,
  mimeType: String,
  size: Number,
  status: String,
  processingError: String,
  uploadedAt: { type: Date, default: Date.now },
  processedAt: Date,
  metadata: {
    category: String,
    description: String,
    isSystemFile: Boolean
  }
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
  content: String,
  chunkIndex: Number,
  metadata: {
    source: String,
    page: Number,
    section: String,
    tags: [String],
    fileName: String
  },
  embedding: [Number]
}, { timestamps: true });

const File = mongoose.model('File', fileSchema);
const Document = mongoose.model('Document', documentSchema);

async function verifyDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 ===== DATABASE VERIFICATION =====\n');

    // Check files
    console.log('📁 Files Collection:');
    console.log('=' .repeat(40));
    
    const totalFiles = await File.countDocuments();
    const systemFiles = await File.find({ userId: null });
    const userFiles = await File.find({ userId: { $ne: null } });
    
    console.log(`Total files: ${totalFiles}`);
    console.log(`System files: ${systemFiles.length}`);
    console.log(`User files: ${userFiles.length}\n`);
    
    // List system files
    if (systemFiles.length > 0) {
      console.log('System Files Details:');
      systemFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.originalName}`);
        console.log(`     - Type: ${file.fileType}`);
        console.log(`     - Status: ${file.status}`);
        console.log(`     - Category: ${file.metadata?.category || 'none'}`);
        console.log(`     - Size: ${file.size} bytes`);
        console.log(`     - Uploaded: ${file.uploadedAt.toISOString()}`);
        if (file.processedAt) {
          console.log(`     - Processed: ${file.processedAt.toISOString()}`);
        }
        if (file.processingError) {
          console.log(`     - Error: ${file.processingError}`);
        }
        console.log('');
      });
    }

    // Check documents
    console.log('📄 Documents Collection:');
    console.log('=' .repeat(40));
    
    const totalDocuments = await Document.countDocuments();
    const systemDocuments = await Document.find({ userId: null }).populate('fileId', 'originalName');
    const userDocuments = await Document.find({ userId: { $ne: null } }).populate('fileId', 'originalName');
    
    console.log(`Total documents: ${totalDocuments}`);
    console.log(`System documents: ${systemDocuments.length}`);
    console.log(`User documents: ${userDocuments.length}\n`);
    
    // List system documents grouped by file
    if (systemDocuments.length > 0) {
      console.log('System Documents Details:');
      const docsByFile = {};
      systemDocuments.forEach(doc => {
        const fileName = doc.fileId?.originalName || 'Unknown File';
        if (!docsByFile[fileName]) {
          docsByFile[fileName] = [];
        }
        docsByFile[fileName].push(doc);
      });
      
      Object.keys(docsByFile).forEach((fileName, index) => {
        const docs = docsByFile[fileName];
        console.log(`  ${index + 1}. ${fileName} (${docs.length} chunks)`);
        docs.forEach((doc, docIndex) => {
          console.log(`     Chunk ${doc.chunkIndex}: ${doc.content.length} chars - "${doc.content.substring(0, 80)}..."`);
        });
        console.log('');
      });
    }

    // Check file status breakdown
    console.log('📈 File Status Breakdown:');
    console.log('=' .repeat(40));
    
    const statusCounts = await File.aggregate([
      { $match: { userId: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    statusCounts.forEach(status => {
      console.log(`${status._id}: ${status.count} files`);
    });
    
    console.log('\n✅ Database verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

verifyDatabase().catch(console.error);

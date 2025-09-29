const mongoose = require('mongoose');
const { vectorStore } = require('./dist/services/vectorStore');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism-chatbot';

async function cleanupDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🧽 Starting database cleanup...');
    
    // Clean up invalid embeddings
    const result = await vectorStore.cleanupInvalidEmbeddings();
    
    console.log('📊 Cleanup Results:');
    console.log(`✅ Cleaned up ${result.cleaned} invalid embeddings`);
    
    if (result.errors.length > 0) {
      console.log('⚠️ Errors found:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Get updated stats
    const stats = await vectorStore.getEmbeddingStats();
    console.log('📊 Updated Embedding Statistics:');
    console.log(`  - Total documents: ${stats.totalDocuments}`);
    console.log(`  - Documents with embeddings: ${stats.documentsWithEmbeddings}`);
    console.log(`  - Documents without embeddings: ${stats.documentsWithoutEmbeddings}`);
    console.log(`  - Embedding coverage: ${stats.embeddingCoverage.toFixed(1)}%`);
    
    console.log('✅ Database cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run cleanup
cleanupDatabase();

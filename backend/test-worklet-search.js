// Test script to verify worklet ID search functionality
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism';

async function testWorkletSearch() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Define Project schema
    const projectSchema = new mongoose.Schema({
      workletId: String,
      workletTitle: String,
      domain: String,
      mentors: [String],
      students: [String],
      college: String,
      status: String,
      stage: String,
      professors: [String],
      userEmails: [String],
      userNames: [String],
    });

    const Project = mongoose.model('Project', projectSchema);

    // Test different worklet ID variations
    const testIds = ['1', '01', '001'];
    
    console.log('\n🔍 Testing worklet ID search variations...\n');
    
    for (const testId of testIds) {
      console.log(`Testing ID: "${testId}"`);
      
      // Try exact match
      const exactMatch = await Project.findOne({ workletId: testId });
      console.log(`  Exact match "${testId}":`, exactMatch ? `Found: ${exactMatch.workletTitle}` : 'Not found');
      
      // Try padded version
      const paddedId = testId.padStart(3, '0');
      const paddedMatch = await Project.findOne({ workletId: paddedId });
      console.log(`  Padded "${paddedId}":`, paddedMatch ? `Found: ${paddedMatch.workletTitle}` : 'Not found');
      
      // Try as number (remove leading zeros)
      const numericId = parseInt(testId).toString();
      const numericMatch = await Project.findOne({ workletId: numericId });
      console.log(`  Numeric "${numericId}":`, numericMatch ? `Found: ${numericMatch.workletTitle}` : 'Not found');
      
      console.log('');
    }

    // Show all project worklet IDs for reference
    const allProjects = await Project.find({}, { workletId: 1, workletTitle: 1 }).limit(10);
    console.log('📋 Available worklet IDs in database:');
    allProjects.forEach(project => {
      console.log(`  ${project.workletId}: ${project.workletTitle}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

testWorkletSearch();
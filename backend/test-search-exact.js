// Test the exact worklet ID search functionality
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

const testSearchExactProject = async () => {
  try {
    await connectDB();
    
    // Import the search function
    const { searchExactProject } = require('./dist/services/projectSearchService');
    
    console.log('🧪 Testing searchExactProject function...\n');
    
    // Test cases for different worklet ID inputs
    const testCases = [
      "1",     // Should find 001
      "01",    // Should find 001  
      "001",   // Should find 001
      "2",     // Should find 002
      "10",    // Should find 010
      "50",    // Should find 050
      "100",   // Should find 100
      "999"    // Should not find anything
    ];
    
    for (const testId of testCases) {
      console.log(`🔍 Testing worklet ID: "${testId}"`);
      
      try {
        const result = await searchExactProject(testId, { isAdmin: true });
        
        if (result && result.project) {
          console.log(`  ✅ Found: ${result.project.workletId} - ${result.project.workletTitle}`);
          console.log(`  📊 Match type: ${result.matchType}`);
        } else {
          console.log(`  ❌ Not found`);
        }
      } catch (error) {
        console.log(`  ⚠️  Error: ${error.message}`);
      }
      
      console.log(''); // Empty line for spacing
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

testSearchExactProject();
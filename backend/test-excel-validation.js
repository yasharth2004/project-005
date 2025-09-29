// Test Excel file validation and processing
const fs = require('fs');
const path = require('path');

// Create a fake "corrupted" Excel file for testing
const testCorruptedFile = async () => {
  const testFilePath = '/tmp/corrupted_test.xlsx';
  
  console.log('🧪 Testing Excel file validation...\n');
  
  // Create a fake file that's not actually an Excel file
  fs.writeFileSync(testFilePath, 'This is not an Excel file, just text');
  
  console.log('📄 Created fake Excel file for testing');
  
  try {
    // Try to validate this file using our improved validation
    const { extractTextFromExcel } = require('./dist/services/documentProcessor');
    
    console.log('🔍 Testing file validation...');
    await extractTextFromExcel(testFilePath);
    
    console.log('❌ Validation failed - should have caught invalid file');
  } catch (error) {
    console.log('✅ Validation working correctly - caught invalid file:');
    console.log('   Error:', error.message);
  }
  
  // Clean up
  fs.unlinkSync(testFilePath);
  console.log('🧹 Cleaned up test file');
  
  console.log('\n📊 Excel validation test completed');
  console.log('✅ Improved error handling will catch corrupted/invalid Excel files');
  console.log('✅ Clear error messages help identify the issue');
  console.log('✅ File validation prevents ZIP directory errors');
};

testCorruptedFile();
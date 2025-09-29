// Test the RAG service with worklet queries
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

const testRAGQueries = async () => {
  try {
    await connectDB();
    
    // Import models and functions
    const { generateRAGResponse } = require('./dist/services/ragService');
    const { User } = require('./dist/models/User');
    
    console.log('🧪 Testing RAG queries for worklet IDs...\n');
    
    // Create or find a test user
    let testUser = await User.findOne({ email: 'test@samsung.com' });
    if (!testUser) {
      testUser = new User({
        email: 'test@samsung.com',
        password: 'hashedpassword123',
        name: 'Test User',
        role: 'admin'
      });
      await testUser.save();
      console.log('✅ Created test user');
    } else {
      console.log('✅ Found existing test user');
    }
    
    const testUserId = testUser._id.toString();
    
    // Test queries with different worklet ID formats
    const testQueries = [
      "Tell me about worklet id 1",
      "What is worklet 01?", 
      "Show me worklet 001",
      "Worklet ID 2 details",
      "Information about worklet 10",
      "Worklet 50",
      "Details for worklet 100",
      "Tell me about worklet 999" // Should not find anything
    ];
    
    for (const query of testQueries) {
      console.log(`\n🔍 Query: "${query}"`);
      console.log('─'.repeat(50));
      
      try {
        const response = await generateRAGResponse(testUserId, query, 5);
        console.log('📝 Response:', response.answer.substring(0, 200) + (response.answer.length > 200 ? '...' : ''));
        
        // Check if response contains worklet information
        if (response.answer.includes('Worklet ID:') || response.answer.includes('worklet')) {
          console.log('✅ Response contains worklet information');
        } else {
          console.log('⚠️  Response may not contain expected worklet information');
        }
        
      } catch (error) {
        console.log('❌ Error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

testRAGQueries();
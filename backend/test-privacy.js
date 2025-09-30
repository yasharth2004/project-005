const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/prism');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Import models and services
const { User } = require('./src/models/User');
const { generateRAGResponse } = require('./src/services/ragService');

const testPrivacyProtection = async () => {
  await connectDB();
  
  try {
    // Find a student user (should be student75@prism.com with worklet 075)
    const student = await User.findOne({ 
      email: 'student75@prism.com',
      role: 'student' 
    });
    
    if (!student) {
      console.log('❌ Student not found. Please run create-admin.js first to create test users.');
      return;
    }
    
    console.log('👤 Testing with student:', {
      email: student.email,
      workletId: student.workletId,
      role: student.role
    });
    
    // Test cases
    const testQueries = [
      "can you tell me about my worklet details", // Should work - personal query
      "can you tell me about worklet id 80",      // Should be blocked - other worklet
      "tell me about worklet 076",                // Should be blocked - other worklet
      "what is worklet 075",                      // Should work - their own worklet
      "can you tell me about worklet details"     // Should work - personal query without ID
    ];
    
    for (const query of testQueries) {
      console.log('\n' + '='.repeat(60));
      console.log(`🔍 Testing query: "${query}"`);
      console.log('='.repeat(60));
      
      try {
        const response = await generateRAGResponse(student._id.toString(), query, 3);
        console.log('📝 Response:', response.answer.substring(0, 200) + '...');
        
        // Check if privacy protection was triggered
        if (response.answer.includes('privacy and security reasons')) {
          console.log('🔒 ✅ Privacy protection ACTIVATED');
        } else if (response.answer.includes('Your worklet 075')) {
          console.log('🎯 ✅ Personal worklet response');
        } else {
          console.log('ℹ️ General response');
        }
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Test completed');
  }
};

testPrivacyProtection();
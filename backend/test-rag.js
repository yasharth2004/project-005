const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Test RAG functionality
const testRAG = async () => {
  console.log('🤖 Testing RAG (Retrieval-Augmented Generation) functionality...\n');

  try {
    // Step 1: Register/Login user
    console.log('1️⃣ Authenticating user...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    
    authToken = loginResponse.data.data.token;
    console.log('✅ Authentication successful\n');

    // Step 2: Upload a test file
    console.log('2️⃣ Uploading test file...');
    const FormData = require('form-data');
    const fs = require('fs');
    
    const form = new FormData();
    form.append('file', fs.createReadStream('./uploads/test-prism-overview.txt'));
    
    const uploadResponse = await axios.post(`${BASE_URL}/files/upload`, form, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...form.getHeaders()
      }
    });
    
    console.log('✅ File upload successful:', uploadResponse.data.data.file.originalName);
    console.log('⏳ Waiting for document processing...\n');

    // Step 3: Wait for processing and test chat
    console.log('3️⃣ Testing chat with RAG...');
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const chatResponse = await axios.post(`${BASE_URL}/chat/generate`, {
      query: 'What is Samsung PRISM program and what are its key objectives?',
      limit: 3
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Chat response generated successfully!');
    console.log('\n📝 Response:');
    console.log(chatResponse.data.data.answer);
    
    console.log('\n📚 Sources used:');
    chatResponse.data.data.sources.forEach((source, index) => {
      console.log(`${index + 1}. ${source.fileName} (Chunk ${source.chunkIndex}) - Score: ${source.relevanceScore.toFixed(3)}`);
      console.log(`   Content: "${source.content.substring(0, 100)}..."`);
    });

    // Step 4: Test another query
    console.log('\n4️⃣ Testing follow-up question...');
    
    const followUpResponse = await axios.post(`${BASE_URL}/chat/generate`, {
      query: 'What technologies are covered in PRISM?',
      limit: 3
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Follow-up response generated!');
    console.log('\n📝 Response:');
    console.log(followUpResponse.data.data.answer);

    console.log('\n🎉 RAG functionality test completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- ✅ User authentication');
    console.log('- ✅ File upload and processing');
    console.log('- ✅ Document search and retrieval');
    console.log('- ✅ AI response generation with context');
    console.log('- ✅ Source attribution');

  } catch (error) {
    console.error('❌ RAG test failed:', error.response?.data || error.message);
    
    if (error.response?.data?.error?.includes('Ollama')) {
      console.log('\n💡 Make sure Ollama is running:');
      console.log('1. Install Ollama from https://ollama.ai/');
      console.log('2. Run: ollama pull phi');
      console.log('3. Run: ollama serve');
    }
  }
};

// Run the test
testRAG();

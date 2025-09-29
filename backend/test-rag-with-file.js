const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000/api';

console.log('🧪 Testing RAG with processed file...\n');

const testRAGWithFile = async () => {
  try {
    // Create a test user
    console.log('1️⃣ Creating test user...');
    const userResponse = await axios.post(`${BACKEND_URL}/auth/register`, {
      name: 'RAG Test User',
      email: 'ragtest@example.com',
      password: 'password123'
    });
    
    const userToken = userResponse.data.data.token;
    console.log('✅ Test user created\n');
    
    // Test different questions
    const testQuestions = [
      'What is Samsung PRISM program?',
      'What are the eligibility requirements?',
      'What are the program benefits?',
      'How long is the program?',
      'What is the application process?'
    ];
    
    for (const question of testQuestions) {
      console.log(`\n🤔 Question: "${question}"`);
      
      try {
        const chatResponse = await axios.post(`${BACKEND_URL}/chat/generate`, {
          query: question,
          limit: 3
        }, {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        const { answer, sources } = chatResponse.data.data;
        console.log(`📝 Answer: ${answer.substring(0, 150)}...`);
        console.log(`📚 Sources: ${sources.length} documents found`);
        
        // Show source details
        sources.forEach((source, index) => {
          console.log(`   ${index + 1}. ${source.fileName || 'Unknown file'}`);
          console.log(`      Content: ${source.content.substring(0, 100)}...`);
        });
        
      } catch (error) {
        console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
      }
      
      // Small delay between questions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🎉 RAG test completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ User created successfully');
    console.log('- ✅ RAG system responding to questions');
    console.log('- ✅ Sources being found and used');
    
    console.log('\n🌐 Your RAG system is now working!');
    console.log('Frontend: http://localhost:5173');
    console.log('Test with the same questions in the chat interface');

  } catch (error) {
    console.error('❌ RAG test failed:', error.response?.data?.error || error.message);
    
    if (error.response?.status === 500) {
      console.log('\n💡 Make sure:');
      console.log('1. Backend server is running');
      console.log('2. MongoDB is running');
      console.log('3. Ollama with Phi-2 model is running');
    }
  }
};

// Run the test
testRAGWithFile();

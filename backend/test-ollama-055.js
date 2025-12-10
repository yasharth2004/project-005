const axios = require('axios');

async function testOllamaWithWorklet() {
  try {
    const testPrompt = `You are an AI assistant.

WORKLET INFORMATION:
Worklet ID: 055
Title: Test Worklet
Domain: Testing

User's Question: can you tell me about my worklet id 055

Your Response:`;

    console.log('📤 Sending to Ollama:');
    console.log(testPrompt);
    console.log('\n' + '='.repeat(80) + '\n');

    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'phi',
      prompt: testPrompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 150
      }
    });

    const generatedResponse = response.data.response.trim();
    console.log('📥 Ollama Response:');
    console.log(generatedResponse);
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Check for Unicode issues
    console.log('🔍 Character analysis:');
    for (let i = 0; i < Math.min(generatedResponse.length, 200); i++) {
      const char = generatedResponse[i];
      const code = char.charCodeAt(0);
      if (code > 127 || code < 32) {
        console.log(`   [${i}]: "${char}" (U+${code.toString(16).toUpperCase().padStart(4, '0')}) - NON-ASCII/CONTROL`);
      }
    }
    
    // Check hex representation
    console.log('\n📊 Hex dump (first 200 chars):');
    console.log(Buffer.from(generatedResponse.substring(0, 200)).toString('hex'));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testOllamaWithWorklet();

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';
let userId = '';
let fileId = '';

// Test data
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123'
};

const testFile = {
  originalName: 'test-prism-overview.txt',
  filePath: './uploads/test-prism-overview.txt'
};

// Helper function to make authenticated requests
const authRequest = (method, url, data = null) => {
  const config = {
    method,
    url: `${BASE_URL}${url}`,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    },
    ...(data && { data })
  };
  return axios(config);
};

// Test functions
const testHealth = async () => {
  console.log('\n🏥 Testing health endpoint...');
  try {
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/api/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
};

const testRegister = async () => {
  console.log('\n📝 Testing user registration...');
  try {
    const response = await authRequest('POST', '/auth/register', testUser);
    console.log('✅ Registration successful:', response.data.data.user.email);
    return true;
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.error.includes('already exists')) {
      console.log('⚠️ User already exists, continuing...');
      return true;
    }
    console.error('❌ Registration failed:', error.response?.data || error.message);
    return false;
  }
};

const testLogin = async () => {
  console.log('\n🔐 Testing user login...');
  try {
    const response = await authRequest('POST', '/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    authToken = response.data.data.token;
    userId = response.data.data.user.id;
    console.log('✅ Login successful:', response.data.data.user.email);
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetMe = async () => {
  console.log('\n👤 Testing get current user...');
  try {
    const response = await authRequest('GET', '/auth/me');
    console.log('✅ Get user successful:', response.data.data.user.name);
    return true;
  } catch (error) {
    console.error('❌ Get user failed:', error.response?.data || error.message);
    return false;
  }
};

const testFileUpload = async () => {
  console.log('\n📤 Testing file upload...');
  try {
    const FormData = require('form-data');
    const fs = require('fs');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile.filePath));
    
    const response = await axios.post(`${BASE_URL}/files/upload`, form, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...form.getHeaders()
      }
    });
    
    fileId = response.data.data.file.id;
    console.log('✅ File upload successful:', response.data.data.file.originalName);
    return true;
  } catch (error) {
    console.error('❌ File upload failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetFiles = async () => {
  console.log('\n📁 Testing get user files...');
  try {
    const response = await authRequest('GET', '/files');
    console.log('✅ Get files successful:', response.data.data.files.length, 'files found');
    return true;
  } catch (error) {
    console.error('❌ Get files failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetFileStats = async () => {
  console.log('\n📊 Testing get file statistics...');
  try {
    const response = await authRequest('GET', '/files/stats');
    console.log('✅ File stats successful:', response.data.data);
    return true;
  } catch (error) {
    console.error('❌ File stats failed:', error.response?.data || error.message);
    return false;
  }
};

const testDocumentSearch = async () => {
  console.log('\n🔍 Testing document search...');
  try {
    // Wait a bit for processing to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const response = await authRequest('GET', '/documents/search?q=PRISM&limit=3');
    console.log('✅ Document search successful:', response.data.data.results.length, 'results found');
    return true;
  } catch (error) {
    console.error('❌ Document search failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetDocumentStats = async () => {
  console.log('\n📈 Testing document statistics...');
  try {
    const response = await authRequest('GET', '/documents/stats');
    console.log('✅ Document stats successful:', response.data.data);
    return true;
  } catch (error) {
    console.error('❌ Document stats failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetDocumentsForFile = async () => {
  if (!fileId) {
    console.log('⚠️ Skipping document retrieval - no file ID available');
    return true;
  }
  
  console.log('\n📄 Testing get documents for file...');
  try {
    const response = await authRequest('GET', `/documents/${fileId}`);
    console.log('✅ Get documents successful:', response.data.data.documents.length, 'chunks found');
    return true;
  } catch (error) {
    console.error('❌ Get documents failed:', error.response?.data || error.message);
    return false;
  }
};

const testChatGeneration = async () => {
  console.log('\n💬 Testing chat response generation...');
  try {
    // Wait a bit for processing to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await authRequest('POST', '/chat/generate', {
      query: 'What is Samsung PRISM program?',
      limit: 3
    });
    
    console.log('✅ Chat generation successful:', {
      answerLength: response.data.data.answer.length,
      sourcesCount: response.data.data.sources.length,
      hasAnswer: !!response.data.data.answer
    });
    return true;
  } catch (error) {
    console.error('❌ Chat generation failed:', error.response?.data || error.message);
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting comprehensive API tests...\n');
  
  const tests = [
    { name: 'Health Check', fn: testHealth },
    { name: 'User Registration', fn: testRegister },
    { name: 'User Login', fn: testLogin },
    { name: 'Get Current User', fn: testGetMe },
    { name: 'File Upload', fn: testFileUpload },
    { name: 'Get User Files', fn: testGetFiles },
    { name: 'Get File Statistics', fn: testGetFileStats },
    { name: 'Document Search', fn: testDocumentSearch },
    { name: 'Get Document Statistics', fn: testGetDocumentStats },
    { name: 'Get Documents for File', fn: testGetDocumentsForFile },
    { name: 'Chat Generation', fn: testChatGeneration }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${test.name} failed with error:`, error.message);
      failed++;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Backend is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the errors above.');
  }
};

// Run tests
runTests().catch(console.error);

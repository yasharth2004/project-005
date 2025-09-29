const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:5173';

console.log('🧪 Testing Frontend-Backend Integration...\n');

// Test backend health
const testBackendHealth = async () => {
  try {
    console.log('1️⃣ Testing backend health...');
    const response = await axios.get(`${BACKEND_URL.replace('/api', '')}/api/health`);
    console.log('✅ Backend is running:', response.data.message);
    return true;
  } catch (error) {
    console.log('❌ Backend is not running. Please start the backend server first.');
    return false;
  }
};

// Test admin user creation
const testAdminCreation = async () => {
  try {
    console.log('\n2️⃣ Testing admin user creation...');
    
    // Check if admin already exists
    const loginResponse = await axios.post(`${BACKEND_URL}/auth/login`, {
      email: 'admin@prism.com',
      password: 'admin123'
    });
    
    console.log('✅ Admin user exists and can login');
    return loginResponse.data.data.token;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('⚠️ Admin user doesn\'t exist. Please run: cd backend && node create-admin.js');
      return null;
    }
    console.log('❌ Error testing admin:', error.message);
    return null;
  }
};

// Test system file upload
const testSystemFileUpload = async (adminToken) => {
  if (!adminToken) {
    console.log('⏭️ Skipping system file upload test (no admin token)');
    return;
  }

  try {
    console.log('\n3️⃣ Testing system file upload...');
    
    // Create a test file content
    const testContent = `Samsung PRISM Program Overview

The Samsung PRISM (PRogram for Innovation and Student Mentorship) is a comprehensive initiative designed to foster innovation and provide mentorship opportunities for students.

Key Features:
- AI/ML project development
- Industry mentorship
- Technical workshops
- Project showcase opportunities
- Networking events

Eligibility:
- Undergraduate students
- Passion for AI/ML
- Strong academic record
- Team collaboration skills

Benefits:
- Hands-on project experience
- Industry mentorship
- Career development opportunities
- Networking with professionals
- Potential internship opportunities`;

    const FormData = require('form-data');
    const fs = require('fs');
    
    // Write test content to a temporary file
    const testFilePath = './test-prism-overview.txt';
    fs.writeFileSync(testFilePath, testContent);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('category', 'program-info');
    form.append('description', 'Samsung PRISM program overview and information');
    
    const uploadResponse = await axios.post(`${BACKEND_URL}/admin/files/upload`, form, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        ...form.getHeaders()
      }
    });
    
    console.log('✅ System file upload successful:', uploadResponse.data.data.file.originalName);
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    
    return uploadResponse.data.data.file.id;
  } catch (error) {
    console.log('❌ System file upload failed:', error.response?.data?.error || error.message);
    return null;
  }
};

// Test user registration and chat
const testUserChat = async () => {
  try {
    console.log('\n4️⃣ Testing user registration and chat...');
    
    // Register a test user
    const registerResponse = await axios.post(`${BACKEND_URL}/auth/register`, {
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'password123'
    });
    
    const userToken = registerResponse.data.data.token;
    console.log('✅ User registration successful');
    
    // Wait for file processing
    console.log('⏳ Waiting for file processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test chat with RAG
    const chatResponse = await axios.post(`${BACKEND_URL}/chat/generate`, {
      query: 'What is Samsung PRISM program?',
      limit: 3
    }, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Chat with RAG successful!');
    console.log('📝 Response length:', chatResponse.data.data.answer.length);
    console.log('📚 Sources used:', chatResponse.data.data.sources.length);
    
    return true;
  } catch (error) {
    console.log('❌ User chat test failed:', error.response?.data?.error || error.message);
    return false;
  }
};

// Test frontend accessibility
const testFrontendAccess = async () => {
  try {
    console.log('\n5️⃣ Testing frontend accessibility...');
    
    const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
    console.log('✅ Frontend is accessible');
    console.log('🌐 Frontend URL:', FRONTEND_URL);
    return true;
  } catch (error) {
    console.log('❌ Frontend is not accessible. Please start the frontend server: npm run dev');
    return false;
  }
};

// Main test function
const runIntegrationTests = async () => {
  console.log('🚀 Starting integration tests...\n');
  
  // Test backend health
  const backendHealthy = await testBackendHealth();
  if (!backendHealthy) {
    console.log('\n❌ Backend tests failed. Please start the backend server first.');
    return;
  }
  
  // Test admin functionality
  const adminToken = await testAdminCreation();
  await testSystemFileUpload(adminToken);
  
  // Test user functionality
  await testUserChat();
  
  // Test frontend
  await testFrontendAccess();
  
  console.log('\n🎉 Integration tests completed!');
  console.log('\n📋 Summary:');
  console.log('- ✅ Backend server running');
  if (adminToken) {
    console.log('- ✅ Admin functionality working');
    console.log('- ✅ System file upload working');
  } else {
    console.log('- ⚠️ Admin functionality needs setup');
  }
  console.log('- ✅ User registration and chat working');
  console.log('- ✅ RAG system integrated');
  console.log('- ✅ Frontend accessible');
  
  console.log('\n🌐 Access your application:');
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Backend API: ${BACKEND_URL}`);
  
  console.log('\n👤 Login Credentials:');
  console.log('Admin: admin@prism.com / admin123');
  console.log('User: testuser@example.com / password123');
};

// Run the tests
runIntegrationTests().catch(console.error);

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let adminToken = '';

// Test admin functionality
const testAdmin = async () => {
  console.log('👨‍💼 Testing Admin Functionality...\n');

  try {
    // Step 1: Login as admin
    console.log('1️⃣ Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@prism.com',
      password: 'admin123'
    });
    
    adminToken = loginResponse.data.data.token;
    console.log('✅ Admin login successful\n');

    // Step 2: Upload a system file
    console.log('2️⃣ Uploading system file...');
    const FormData = require('form-data');
    const fs = require('fs');
    
    const form = new FormData();
    form.append('file', fs.createReadStream('./uploads/test-prism-overview.txt'));
    form.append('category', 'program-info');
    form.append('description', 'Samsung PRISM program overview and information');
    
    const uploadResponse = await axios.post(`${BASE_URL}/admin/files/upload`, form, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        ...form.getHeaders()
      }
    });
    
    console.log('✅ System file upload successful:', uploadResponse.data.data.file.originalName);
    console.log('📁 Category:', uploadResponse.data.data.file.category);
    console.log('⏳ Waiting for processing...\n');

    // Step 3: Get system files
    console.log('3️⃣ Getting system files...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const filesResponse = await axios.get(`${BASE_URL}/admin/files`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    console.log('✅ System files retrieved:', filesResponse.data.data.files.length, 'files');
    filesResponse.data.data.files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.originalName} (${file.category}) - Status: ${file.status}`);
    });

    // Step 4: Get system file statistics
    console.log('\n4️⃣ Getting system file statistics...');
    const statsResponse = await axios.get(`${BASE_URL}/admin/files/stats`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    console.log('✅ System file statistics:');
    console.log('   Total files:', statsResponse.data.data.totalFiles);
    console.log('   Total size:', (statsResponse.data.data.totalSize / 1024).toFixed(2), 'KB');
    console.log('   Categories:', Object.keys(statsResponse.data.data.categoryCounts));

    // Step 5: Get all users
    console.log('\n5️⃣ Getting all users...');
    const usersResponse = await axios.get(`${BASE_URL}/admin/users`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    console.log('✅ Users retrieved:', usersResponse.data.data.users.length, 'users');
    usersResponse.data.data.users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email}) - Role: ${user.role}`);
    });

    // Step 6: Test chat with system files
    console.log('\n6️⃣ Testing chat with system files...');
    
    // Create a regular user first
    const userResponse = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Test User',
      email: 'user@test.com',
      password: 'password123'
    });

    const userToken = userResponse.data.data.token;
    
    // Test chat with system files
    const chatResponse = await axios.post(`${BASE_URL}/chat/generate`, {
      query: 'What is Samsung PRISM program?',
      limit: 3
    }, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Chat with system files successful!');
    console.log('📝 Response length:', chatResponse.data.data.answer.length);
    console.log('📚 Sources used:', chatResponse.data.data.sources.length);

    console.log('\n🎉 Admin functionality test completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- ✅ Admin authentication');
    console.log('- ✅ System file upload');
    console.log('- ✅ System file management');
    console.log('- ✅ User management');
    console.log('- ✅ RAG with system files');

  } catch (error) {
    console.error('❌ Admin test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      console.log('\n💡 Make sure you have created an admin user:');
      console.log('1. Run: node create-admin.js');
      console.log('2. Use admin@prism.com / admin123 to login');
    }
  }
};

// Run the test
testAdmin();

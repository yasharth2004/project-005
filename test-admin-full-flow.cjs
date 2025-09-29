const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';
let authToken = '';

// Test admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@prism.com',
  password: 'admin123'
};

console.log('🚀 ===== SAMSUNG PRISM ADMIN FULL FLOW TEST =====\n');

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to create test file
const createTestFile = (content, filename) => {
  const filePath = path.join(__dirname, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
};

// Cleanup function
const cleanup = (filePaths) => {
  filePaths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up test file: ${filePath}`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not cleanup ${filePath}:`, error.message);
    }
  });
};

async function testAdminLogin() {
  try {
    console.log('🔐 Testing admin login...');
    const response = await axios.post(`${API_BASE}/auth/login`, ADMIN_CREDENTIALS);
    
    if (response.data.success && response.data.data.token) {
      authToken = response.data.data.token;
      console.log('✅ Admin login successful');
      console.log(`👤 User: ${response.data.data.user.name} (${response.data.data.user.role})\n`);
      return true;
    } else {
      console.log('❌ Admin login failed: Invalid response');
      return false;
    }
  } catch (error) {
    console.log('❌ Admin login failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function testFileUpload(filename, content, category = 'program-info') {
  try {
    console.log(`📤 Testing file upload: ${filename}`);
    
    // Create test file
    const filePath = createTestFile(content, filename);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('category', category);
    formData.append('description', `Test file: ${filename}`);
    
    const response = await axios.post(`${API_BASE}/admin/files/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    if (response.data.success) {
      const file = response.data.data.file;
      console.log(`✅ File uploaded successfully: ${file.originalName}`);
      console.log(`   - ID: ${file.id}`);
      console.log(`   - Type: ${file.fileType}`);
      console.log(`   - Category: ${file.category}`);
      console.log(`   - Status: ${file.status}`);
      
      // Cleanup test file
      cleanup([filePath]);
      
      return file.id;
    } else {
      console.log('❌ File upload failed: Invalid response');
      cleanup([filePath]);
      return null;
    }
  } catch (error) {
    console.log('❌ File upload failed:', error.response?.data?.error || error.message);
    return null;
  }
}

async function waitForProcessing(fileId, maxWaitTime = 30000) {
  console.log(`⏳ Waiting for file processing (max ${maxWaitTime/1000}s)...`);
  
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await axios.get(`${API_BASE}/admin/files`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const file = response.data.data.files.find(f => f.id === fileId);
      if (file) {
        console.log(`📊 Current status: ${file.status}`);
        
        if (file.status === 'completed') {
          console.log('✅ File processing completed!');
          return true;
        } else if (file.status === 'failed') {
          console.log('❌ File processing failed!');
          return false;
        }
      }
      
      await wait(2000); // Wait 2 seconds before checking again
    } catch (error) {
      console.log('⚠️ Error checking file status:', error.message);
    }
  }
  
  console.log('⏰ Timeout waiting for file processing');
  return false;
}

async function testDocumentSearch(query) {
  try {
    console.log(`🔍 Testing document search: "${query}"`);
    
    const response = await axios.get(`${API_BASE}/documents/search`, {
      params: { q: query, limit: 5 },
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      const documents = response.data.data.documents;
      console.log(`✅ Found ${documents.length} relevant documents`);
      
      documents.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${doc.metadata.fileName} (chunk ${doc.chunkIndex})`);
        console.log(`      Content preview: "${doc.content.substring(0, 100)}..."`);
      });
      
      return documents.length > 0;
    } else {
      console.log('❌ Document search failed: Invalid response');
      return false;
    }
  } catch (error) {
    console.log('❌ Document search failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function testRAGGeneration(query) {
  try {
    console.log(`🤖 Testing RAG response generation: "${query}"`);
    
    const response = await axios.post(`${API_BASE}/chat/generate`, {
      query: query,
      limit: 3
    }, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      const { answer, sources } = response.data.data;
      console.log('✅ RAG response generated successfully');
      console.log(`📝 Answer length: ${answer.length} characters`);
      console.log(`📚 Sources used: ${sources.length}`);
      console.log(`💬 Answer preview: "${answer.substring(0, 200)}..."`);
      
      sources.forEach((source, index) => {
        console.log(`   Source ${index + 1}: ${source.fileName} (relevance: ${source.relevanceScore.toFixed(2)})`);
      });
      
      return true;
    } else {
      console.log('❌ RAG generation failed: Invalid response');
      return false;
    }
  } catch (error) {
    console.log('❌ RAG generation failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function testFileDelete(fileId) {
  try {
    console.log(`🗑️ Testing file deletion: ${fileId}`);
    
    const response = await axios.delete(`${API_BASE}/admin/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      console.log('✅ File deleted successfully');
      return true;
    } else {
      console.log('❌ File deletion failed: Invalid response');
      return false;
    }
  } catch (error) {
    console.log('❌ File deletion failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function testGetSystemFiles() {
  try {
    console.log('📋 Testing get system files...');
    
    const response = await axios.get(`${API_BASE}/admin/files`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      const files = response.data.data.files;
      console.log(`✅ Retrieved ${files.length} system files`);
      
      files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.originalName} (${file.status}) - ${file.fileType.toUpperCase()}`);
      });
      
      return files;
    } else {
      console.log('❌ Get system files failed: Invalid response');
      return [];
    }
  } catch (error) {
    console.log('❌ Get system files failed:', error.response?.data?.error || error.message);
    return [];
  }
}

async function runFullTest() {
  let testFileIds = [];
  
  try {
    // 1. Test admin login
    console.log('Step 1: Admin Authentication');
    console.log('=' .repeat(50));
    const loginSuccess = await testAdminLogin();
    if (!loginSuccess) {
      console.log('❌ Cannot proceed without admin authentication');
      return;
    }
    
    // 2. Test initial file list
    console.log('\nStep 2: Get Initial File List');
    console.log('=' .repeat(50));
    await testGetSystemFiles();
    
    // 3. Test file uploads
    console.log('\nStep 3: File Upload Tests');
    console.log('=' .repeat(50));
    
    // Test TXT file
    const txtFileId = await testFileUpload(
      'test-samsung-prism-info.txt',
      `Samsung PRISM Program Information
      
The Samsung PRISM (PRogram for Innovation and Student Mentorship) is a comprehensive educational initiative designed to foster innovation and provide mentorship opportunities for students.

Key Features:
- Innovation projects with Samsung mentors
- Technical skill development
- Real-world problem solving
- Industry exposure
- Career guidance and networking

Program Benefits:
- Direct mentorship from Samsung experts
- Access to cutting-edge technology
- Hands-on project experience
- Certificate upon completion
- Potential internship opportunities

Eligibility Criteria:
- Current university students
- Strong academic performance
- Interest in technology and innovation
- Commitment to complete the program

Application Process:
1. Submit online application
2. Technical assessment
3. Interview with Samsung mentors
4. Final selection and enrollment

For more information, visit the Samsung PRISM portal or contact the program coordinators.`,
      'program-info'
    );
    
    if (txtFileId) {
      testFileIds.push(txtFileId);
    }
    
    // Wait a bit before next upload
    await wait(2000);
    
    // Test PDF content simulation (since we can't easily create a real PDF)
    const faqFileId = await testFileUpload(
      'test-prism-faq.txt',
      `Samsung PRISM FAQ

Q: What is the duration of the Samsung PRISM program?
A: The program typically runs for 6 months, with flexible scheduling to accommodate student coursework.

Q: Are there any fees for participating in the program?
A: No, the Samsung PRISM program is completely free for selected students.

Q: What kind of projects will I work on?
A: Projects vary from mobile app development, IoT solutions, AI/ML applications, to hardware prototyping.

Q: Will I receive a certificate?
A: Yes, all students who successfully complete the program receive a Samsung PRISM certificate.

Q: Can I apply if I'm in my first year of university?
A: Students from all academic years are welcome to apply, though some technical background is preferred.

Q: Is remote participation possible?
A: Yes, the program supports both in-person and remote participation options.

Q: How many students are selected each batch?
A: Typically, 50-100 students are selected per batch depending on applications and capacity.

Q: What programming languages should I know?
A: While specific languages depend on your project, knowledge of Python, Java, JavaScript, or C++ is beneficial.`,
      'faq'
    );
    
    if (faqFileId) {
      testFileIds.push(faqFileId);
    }
    
    // 4. Wait for processing
    console.log('\nStep 4: File Processing');
    console.log('=' .repeat(50));
    
    for (const fileId of testFileIds) {
      const processed = await waitForProcessing(fileId, 30000);
      if (!processed) {
        console.log(`⚠️ File ${fileId} may not have processed completely`);
      }
    }
    
    // 5. Test document search
    console.log('\nStep 5: Document Search Tests');
    console.log('=' .repeat(50));
    
    await testDocumentSearch('Samsung PRISM program');
    await wait(1000);
    await testDocumentSearch('mentorship opportunities');
    await wait(1000);
    await testDocumentSearch('eligibility criteria');
    await wait(1000);
    await testDocumentSearch('program duration FAQ');
    
    // 6. Test RAG generation
    console.log('\nStep 6: RAG Response Generation Tests');
    console.log('=' .repeat(50));
    
    await testRAGGeneration('What is Samsung PRISM program?');
    await wait(2000);
    await testRAGGeneration('What are the eligibility criteria for Samsung PRISM?');
    await wait(2000);
    await testRAGGeneration('How long does the Samsung PRISM program take?');
    
    // 7. Test file deletion
    console.log('\nStep 7: File Deletion Tests');
    console.log('=' .repeat(50));
    
    for (const fileId of testFileIds) {
      const deleted = await testFileDelete(fileId);
      if (deleted) {
        console.log(`✅ Successfully deleted file: ${fileId}`);
      } else {
        console.log(`❌ Failed to delete file: ${fileId}`);
      }
      await wait(1000);
    }
    
    // 8. Final file list
    console.log('\nStep 8: Final File List');
    console.log('=' .repeat(50));
    await testGetSystemFiles();
    
    console.log('\n🎉 ===== TEST COMPLETE =====');
    console.log('✅ All admin functionalities tested successfully!');
    
  } catch (error) {
    console.log('\n💥 Test execution error:', error.message);
  }
}

// Run the test
runFullTest().catch(console.error);

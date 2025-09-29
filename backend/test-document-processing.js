const fs = require('fs');
const path = require('path');

// Create a test text file
const testContent = `
Samsung PRISM Program Overview

Samsung PRISM (Preparing and Inspiring Student Minds) is a student-industry academia collaboration program initiated and run by Samsung R&D Institute Bangalore (SRI-B), which is Samsung's largest R&D center outside of South Korea.

The program aims to bridge the gap between academic learning and industry demands by involving students and professors in real-world research and development projects. It fosters innovation, enhances technical skills, and contributes to the Indian technology ecosystem.

Key Objectives:
1. Provide students with hands-on experience on live R&D projects
2. Make students industry-ready by exposing them to cutting-edge technologies
3. Stimulate the innovation ecosystem within India
4. Collaborate with academic institutions to solve complex technological problems

Team Structure:
- Teams comprise 3 students and 1 professor from the same institution
- A professor can guide multiple teams (often up to 4)
- Teams are assigned specific project modules known as "worklets"
- These worklets are derived from larger, ongoing projects within Samsung's R&D divisions

Technologies Covered:
- Artificial Intelligence (AI) & Machine Learning (ML)
- Internet of Things (IoT)
- 5G and Communication Networks
- Vision Technologies & Image Processing
- Data Analytics
- Mobile Technologies and Applications

Benefits for Students:
- Practical experience working on industry-relevant R&D projects
- Development of skills in cutting-edge technology domains
- Mentorship from seasoned Samsung R&D professionals
- Enhanced employability and industry readiness
- Opportunity to contribute to real-world solutions
- Potential to co-author research papers or file patents
- Certificates upon successful completion
`;

// Create test file
const testFilePath = path.join(__dirname, 'uploads', 'test-prism-overview.txt');
fs.writeFileSync(testFilePath, testContent);

console.log('✅ Test file created:', testFilePath);
console.log('📝 File content length:', testContent.length, 'characters');
console.log('📄 You can now test file upload with this file');

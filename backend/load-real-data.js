// Load real Excel data to replace sample data
const mongoose = require('mongoose');
require('dotenv').config();
const ExcelJS = require('exceljs');

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

// Create Excel file with real data
const createRealExcelData = async () => {
  try {
    await connectDB();
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Worklet Data');
    
    // Add headers based on your Excel structure
    worksheet.columns = [
      { header: 'Worklet ID', key: 'workletId', width: 12 },
      { header: 'Worklet Title', key: 'workletTitle', width: 50 },
      { header: 'Domain', key: 'domain', width: 25 },
      { header: 'Mentor 1 Name', key: 'mentor1', width: 20 },
      { header: 'Mentor 2 Name', key: 'mentor2', width: 20 },
      { header: 'Student 1 Name', key: 'student1', width: 20 },
      { header: 'Student 2 Name', key: 'student2', width: 20 },
      { header: 'Student 3 Name', key: 'student3', width: 20 },
      { header: 'College', key: 'college', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Stage', key: 'stage', width: 15 },
      { header: 'State', key: 'state', width: 15 },
      { header: 'Professor 1 Name', key: 'professor1', width: 20 },
      { header: 'Professor 2 Name', key: 'professor2', width: 20 }
    ];
    
    // Add real data from your Excel (visible rows)
    const realData = [
      {
        workletId: '001',
        workletTitle: 'Optimizing neural network models for low-power edge devices.',
        domain: 'OnDevice Intelligence',
        mentor1: 'Pradeep P',
        mentor2: 'Anand R',
        student1: 'Abhishek Singh',
        student2: 'Kabir Rao',
        student3: 'Nisha Das',
        college: 'Thapar',
        status: 'Average',
        stage: 'Mid Review',
        state: 'Ongoing',
        professor1: 'Dr. Manish Singh',
        professor2: 'Dr. R. S. Bharadwaj'
      },
      {
        workletId: '002',
        workletTitle: 'Implementing sentiment analysis using natural language processing.',
        domain: 'Language AI',
        mentor1: 'Dr. Ramesh Jain',
        mentor2: 'Dr. Ayesha Khan',
        student1: 'Rajesh Singh',
        student2: 'Aarya Singh',
        student3: 'Dona John',
        college: 'VIT',
        status: 'Good',
        stage: 'End Review',
        state: 'Completed',
        professor1: 'Dr. Anmitra Rao',
        professor2: 'Dr. P. S. Rajashekhan'
      },
      {
        workletId: '003',
        workletTitle: 'Real-time gesture recognition for sign language translation.',
        domain: 'Computer Vision',
        mentor1: 'Kartik Prakash',
        mentor2: 'Vikas Sharma',
        student1: 'Amit Gupta',
        student2: 'Aarav Kumar',
        student3: 'Siddharth Iyer',
        college: 'PSG',
        status: 'Very Good',
        stage: 'Third Review',
        state: 'Ongoing',
        professor1: 'Dr. V. K. Shankar',
        professor2: 'Dr. R. P. Saraswanan'
      },
      {
        workletId: '004',
        workletTitle: 'Building an AI-driven recommendation engine for e-commerce.',
        domain: 'OnDevice Intelligence',
        mentor1: 'Anand R',
        mentor2: 'Asha S',
        student1: 'Rahul Singh',
        student2: 'Priya Singh',
        student3: 'Abhisheka Prasad',
        college: 'Thapar',
        status: 'Excellent',
        stage: 'First Review',
        state: 'Ongoing',
        professor1: 'Dr. Amit Gupta',
        professor2: 'Dr. R. S. Parasuraman'
      },
      {
        workletId: '005',
        workletTitle: 'Real-time monitoring of agricultural fields with sensor networks.',
        domain: 'IoT',
        mentor1: 'Geetha N',
        mentor2: 'Sandees S',
        student1: 'Aniya Singh',
        student2: 'Pooja Sharma',
        student3: 'Aarav Das',
        college: 'VIT',
        status: 'Good',
        stage: 'Mid Review',
        state: 'Ongoing',
        professor1: 'Dr. Aparna Rao',
        professor2: 'Dr. Ramesh Kumar'
      },
      {
        workletId: '006',
        workletTitle: 'Sentiment analysis and social media engagement transformer models.',
        domain: 'Language AI',
        mentor1: 'Manav Kumar',
        mentor2: 'Dr. Ayesha Khan',
        student1: 'Sneha Gopal',
        student2: 'Aarya Singh',
        student3: 'Kshitij Mohite',
        college: 'SIMRU',
        status: 'Very Good',
        stage: 'Third Review',
        state: 'Ongoing',
        professor1: 'Dr. V. Ganesh',
        professor2: 'Dr. S. K. Arvind'
      },
      {
        workletId: '007',
        workletTitle: 'Real-time gesture recognition for sign language translation.',
        domain: 'Computer Vision',
        mentor1: 'Kartik Prakash',
        mentor2: 'Vikas Sharma',
        student1: 'Manish Murthy',
        student2: 'Kabir Rao',
        student3: 'Sameer Iyer',
        college: 'VIT',
        status: 'Very Good',
        stage: 'First Review',
        state: 'Ongoing',
        professor1: 'Dr. R. P. Sundar',
        professor2: 'Dr. P. S. Prasankari'
      },
      {
        workletId: '008',
        workletTitle: 'Developing secure communication protocol for mission critical IoT devices.',
        domain: 'Communication Network',
        mentor1: 'Priya Sharma',
        mentor2: 'Rajesh Gupta',
        student1: 'Anamya Singh',
        student2: 'Aarav Kumar',
        student3: 'Meena Singh',
        college: 'PSG',
        status: 'Excellent',
        stage: 'End Review',
        state: 'Completed',
        professor1: 'Dr. S. K. Palaniasmy',
        professor2: 'Dr. N. K. N'
      },
      {
        workletId: '009',
        workletTitle: 'On-device AI for personalized health monitoring on wearables.',
        domain: 'OnDevice Intelligence',
        mentor1: 'Asha S',
        mentor2: 'Anand R',
        student1: 'Tanya Mehta',
        student2: 'Amit Joshi',
        student3: 'Sanjana Deshmukh',
        college: 'Thapar',
        status: 'Average',
        stage: 'Mid Review',
        state: 'Ongoing',
        professor1: 'Dr. Amit Gupta',
        professor2: 'Dr. Neha Sharma'
      },
      {
        workletId: '010',
        workletTitle: 'Fine-tuning a large language model for medical report summarization.',
        domain: 'Language AI',
        mentor1: 'Dr. Ramesh Jain',
        mentor2: 'Dr. Ayesha Khan',
        student1: 'Aarav Gupta',
        student2: 'Shreya Singhania',
        student3: 'Suman Iyer',
        college: 'PSG',
        status: 'Good',
        stage: 'First Review',
        state: 'Ongoing',
        professor1: 'Dr. V. K. Prakash',
        professor2: 'Dr. S. K. Rajamouly'
      }
    ];
    
    // Add rows to worksheet
    realData.forEach(row => {
      worksheet.addRow(row);
    });
    
    // Save Excel file
    const excelFilePath = '/tmp/real_worklet_data.xlsx';
    await workbook.xlsx.writeFile(excelFilePath);
    console.log('✅ Created Excel file with real data:', excelFilePath);
    
    // Now process this Excel file through our parser
    const { parseProjectsFromExcel, saveProjectsToDatabase } = require('./dist/services/projectParser');
    const Project = require('./dist/models/Project').Project;
    
    console.log('🔄 Processing Excel file through our parser...');
    
    // Clear existing sample data
    await Project.deleteMany({});
    console.log('🧹 Cleared existing sample data');
    
    // Parse and save real data
    const result = await parseProjectsFromExcel(excelFilePath);
    
    if (result.success) {
      console.log(`✅ Successfully processed ${result.projects.length} projects`);
      console.log('📋 Processed Projects:');
      
      for (const project of result.projects) {
        console.log(`  ${project.workletId}: ${project.workletTitle.substring(0, 50)}...`);
      }
      
      // Now save to database
      console.log('\n💾 Saving projects to database...');
      const dummyFileId = new mongoose.Types.ObjectId().toString();
      const dummyUserId = new mongoose.Types.ObjectId().toString();
      
      await saveProjectsToDatabase(result.projects, dummyFileId, dummyUserId);
      
    } else {
      console.log('❌ Failed to process Excel:', result.error);
    }
    
    // Verify what's in database now
    console.log('\n🔍 Verifying database contents...');
    const allProjects = await Project.find({}, { workletId: 1, workletTitle: 1 }).limit(10);
    console.log('📋 Projects now in database:');
    for (const project of allProjects) {
      console.log(`  ${project.workletId}: ${project.workletTitle}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

createRealExcelData();
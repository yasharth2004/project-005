// Load data from the actual uploaded Excel file
const mongoose = require('mongoose');
require('dotenv').config();
const path = require('path');
const { parseProjectsFromExcel, saveProjectsToDatabase } = require('./dist/services/projectParser');

// Use existing Project model
const { Project } = require('./dist/models/Project');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/prism-rag');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const loadExcelData = async () => {
  try {
    await connectDB();

    // Path to the uploaded Excel file
    const excelFilePath = path.join(__dirname, 'uploads', 'synthetic_worklet_data-1759177083500-393237747.xlsx');
    console.log('📊 Loading data from Excel file:', excelFilePath);

    // Parse the Excel file using the existing parser
    const result = await parseProjectsFromExcel(excelFilePath);

    if (!result.success) {
      throw new Error(`Failed to parse Excel: ${result.error}`);
    }

    console.log(`📊 Parsed ${result.projects.length} projects from Excel`);
    console.log('📊 Stats:', result.stats);

    // Clear existing projects
    const deleteCount = await Project.deleteMany({});
    console.log(`🗑️  Deleted ${deleteCount.deletedCount} existing projects`);

    // Save parsed projects to database
    const projectDocuments = result.projects.map(project => ({
      workletId: project.workletId,
      workletTitle: project.workletTitle,
      domain: project.domain,
      mentors: project.mentors,
      students: project.students,
      college: project.college,
      status: project.status,
      stage: project.stage,
      professors: project.professors,
      userEmails: [],
      userNames: [...project.mentors, ...project.students, ...project.professors],
      sourceFile: new mongoose.Types.ObjectId('68dae97be6b881eb722b8a11'), // Use existing file ID
      uploadedBy: new mongoose.Types.ObjectId('689c85e6cfa373d5590df48e')  // Use existing user ID
    }));

    await Project.insertMany(projectDocuments);
    console.log(`✅ Successfully saved ${projectDocuments.length} projects to database`);

    // Verify the data by checking some specific worklet IDs
    console.log('\n🔍 Verifying saved data:');
    const testIds = ['001', '100', '150'];
    for (const id of testIds) {
      const project = await Project.findOne({ workletId: id });
      if (project) {
        console.log(`✅ Worklet ${id}: ${project.workletTitle}`);
      } else {
        console.log(`❌ Worklet ${id}: NOT FOUND`);
      }
    }

    // Show total count and ID range
    const totalCount = await Project.countDocuments();
    const allIds = await Project.find({}, { workletId: 1 }).sort({ workletId: 1 });
    const firstId = allIds[0]?.workletId;
    const lastId = allIds[allIds.length - 1]?.workletId;
    
    console.log(`\n📊 Total projects in database: ${totalCount}`);
    console.log(`📊 Worklet ID range: ${firstId} to ${lastId}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error loading Excel data:', error);
    process.exit(1);
  }
};

loadExcelData();
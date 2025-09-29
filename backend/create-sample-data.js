// Create sample worklet data for testing
const mongoose = require('mongoose');
require('dotenv').config();

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

// Sample data creation
const createSampleData = async () => {
  try {
    await connectDB();
    
    // Get the Project model
    const Project = require('./dist/models/Project').Project;
    
    // Create dummy ObjectIds for required fields
    const dummyFileId = new mongoose.Types.ObjectId();
    const dummyUserId = new mongoose.Types.ObjectId();
    
    // Clear existing data
    await Project.deleteMany({});
    console.log('🧹 Cleared existing project data');
    
    // Sample projects with different worklet ID formats
    const sampleProjects = [
      {
        workletId: "001",
        workletTitle: "AI-Powered Smart Home Automation",
        domain: "Artificial Intelligence",
        mentors: ["Dr. John Smith", "Prof. Mary Johnson"],
        students: ["Alice Brown", "Bob Wilson"],
        college: "Samsung Innovation University",
        status: "ongoing",
        stage: "development",
        professors: ["Dr. John Smith"],
        userEmails: ["alice.brown@samsung.com", "bob.wilson@samsung.com"],
        userNames: ["Alice Brown", "Bob Wilson"],
        sourceFile: dummyFileId,
        uploadedBy: dummyUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        workletId: "002",
        workletTitle: "IoT Healthcare Monitoring System",
        domain: "Internet of Things",
        mentors: ["Dr. Sarah Lee", "Prof. Mike Davis"],
        students: ["Carol Green", "David Taylor"],
        college: "Samsung Innovation University",
        status: "completed",
        stage: "deployment",
        professors: ["Dr. Sarah Lee"],
        userEmails: ["carol.green@samsung.com", "david.taylor@samsung.com"],
        userNames: ["Carol Green", "David Taylor"],
        sourceFile: dummyFileId,
        uploadedBy: dummyUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        workletId: "010",
        workletTitle: "Blockchain Supply Chain Tracker",
        domain: "Blockchain Technology",
        mentors: ["Dr. James Wang", "Prof. Lisa Chen"],
        students: ["Eve Martinez", "Frank Miller"],
        college: "Samsung Innovation University",
        status: "review",
        stage: "testing",
        professors: ["Dr. James Wang"],
        userEmails: ["eve.martinez@samsung.com", "frank.miller@samsung.com"],
        userNames: ["Eve Martinez", "Frank Miller"],
        sourceFile: dummyFileId,
        uploadedBy: dummyUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        workletId: "050",
        workletTitle: "Machine Learning for Predictive Analytics",
        domain: "Machine Learning",
        mentors: ["Dr. Rachel Kim", "Prof. Tom Anderson"],
        students: ["Grace Liu", "Henry Jones"],
        college: "Samsung Innovation University",
        status: "ongoing",
        stage: "research",
        professors: ["Dr. Rachel Kim"],
        userEmails: ["grace.liu@samsung.com", "henry.jones@samsung.com"],
        userNames: ["Grace Liu", "Henry Jones"],
        sourceFile: dummyFileId,
        uploadedBy: dummyUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        workletId: "100",
        workletTitle: "Quantum Computing Research Platform",
        domain: "Quantum Computing",
        mentors: ["Dr. Alex Kumar", "Prof. Nina Patel"],
        students: ["Ian Wright", "Julia Roberts"],
        college: "Samsung Innovation University",
        status: "ongoing",
        stage: "research",
        professors: ["Dr. Alex Kumar"],
        userEmails: ["ian.wright@samsung.com", "julia.roberts@samsung.com"],
        userNames: ["Ian Wright", "Julia Roberts"],
        sourceFile: dummyFileId,
        uploadedBy: dummyUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Insert sample data
    const insertedProjects = await Project.insertMany(sampleProjects);
    console.log(`✅ Created ${insertedProjects.length} sample projects`);
    
    // Display created projects
    console.log('\n📋 Created Projects:');
    for (const project of insertedProjects) {
      console.log(`  ${project.workletId}: ${project.workletTitle} (${project.domain})`);
    }
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

createSampleData();
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism';

const ProjectSchema = new mongoose.Schema({}, { strict: false, collection: 'projects' });
const Project = mongoose.model('Project', ProjectSchema);

async function checkWorklet055() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    // Search for worklet 055
    const variations = ['055', '55', '0055'];
    
    for (const id of variations) {
      console.log(`\n🔎 Searching for worklet ID: "${id}"`);
      const project = await Project.findOne({ workletId: id });
      
      if (project) {
        console.log('✅ Found project:');
        console.log('   Worklet ID:', project.workletId);
        console.log('   Hex representation:', Buffer.from(project.workletId).toString('hex'));
        console.log('   Length:', project.workletId.length);
        console.log('   Title:', project.workletTitle);
        console.log('   Domain:', project.domain);
        console.log('   College:', project.college);
        
        // Check each character
        console.log('   Character breakdown:');
        for (let i = 0; i < project.workletId.length; i++) {
          const char = project.workletId[i];
          const code = char.charCodeAt(0);
          console.log(`     [${i}]: "${char}" (U+${code.toString(16).toUpperCase().padStart(4, '0')}) - ${code}`);
        }
      } else {
        console.log('❌ No project found');
      }
    }
    
    // Also try regex search for anything containing 55
    console.log('\n\n🔎 Searching for any worklet containing "55":');
    const projects = await Project.find({ workletId: /55/ }).limit(5);
    console.log(`Found ${projects.length} projects:`);
    projects.forEach(p => {
      console.log(`   - "${p.workletId}" (hex: ${Buffer.from(p.workletId).toString('hex')}) - ${p.workletTitle}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkWorklet055();

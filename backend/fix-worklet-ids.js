const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism';

const ProjectSchema = new mongoose.Schema({}, { strict: false, collection: 'projects' });
const Project = mongoose.model('Project', ProjectSchema);

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', UserSchema);

async function fixWorkletIds() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully\n');

    // Fix Projects
    console.log('📊 Fixing worklet IDs in Projects collection...');
    const projects = await Project.find({});
    console.log(`Found ${projects.length} projects\n`);

    let projectsFixed = 0;
    for (const project of projects) {
      const originalId = project.workletId;
      // Remove non-printable ASCII characters (keep only printable ASCII: 0x20-0x7E)
      const cleanId = originalId.replace(/[^\x20-\x7E]/g, '').trim();
      
      if (cleanId !== originalId) {
        console.log(`🔄 Fixing: "${originalId}" (${Buffer.from(originalId).toString('hex')}) -> "${cleanId}"`);
        project.workletId = cleanId;
        await project.save();
        projectsFixed++;
      }
    }
    console.log(`\n✅ Fixed ${projectsFixed} project worklet IDs\n`);

    // Fix Users
    console.log('👥 Fixing worklet IDs in Users collection...');
    const users = await User.find({ workletId: { $exists: true, $ne: null } });
    console.log(`Found ${users.length} users with worklet IDs\n`);

    let usersFixed = 0;
    for (const user of users) {
      if (user.workletId) {
        const originalId = user.workletId;
        const cleanId = originalId.replace(/[^\x20-\x7E]/g, '').trim();
        
        if (cleanId !== originalId) {
          console.log(`🔄 Fixing user ${user.username}: "${originalId}" -> "${cleanId}"`);
          user.workletId = cleanId;
          await user.save();
          usersFixed++;
        }
      }
    }
    console.log(`\n✅ Fixed ${usersFixed} user worklet IDs`);

    console.log('\n🎉 All worklet IDs have been cleaned!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixWorkletIds();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Define User schema (simplified version)
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'student'],
    default: 'user'
  },
  workletId: {
    type: String,
    required: function() {
      return this.role === 'student';
    },
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@prism.com' });
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists');
      console.log('Email: admin@prism.com');
      console.log('Role:', existingAdmin.role);
      process.exit(0);
    }

    // Create admin user
    const adminUser = new User({
      email: 'admin@prism.com',
      password: 'admin123', // This will be hashed automatically
      name: 'System Administrator',
      role: 'admin',
      isActive: true
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@prism.com');
    console.log('🔑 Password: admin123');
    console.log('👤 Role: admin');
    console.log('\n💡 You can now use these credentials to access admin features');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

const createDemoUsers = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/samsung-prism';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Demo users to create
    const demoUsers = [
      {
        email: 'admin@prism.com',
        password: 'admin123',
        name: 'System Administrator',
        role: 'admin',
        isActive: true
      },
      {
        email: 'user@test.com',
        password: 'password123',
        name: 'Test User',
        role: 'user',
        isActive: true
      },
      {
        email: 'student@prism.com',
        password: 'student123',
        name: 'John Smith',
        role: 'student',
        workletId: '025',
        isActive: true
      },
      {
        email: 'student75@prism.com',
        password: 'student123',
        name: 'Alex Johnson',
        role: 'student',
        workletId: '075',
        isActive: true
      }
    ];

    for (const userData of demoUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`⚠️ User ${userData.email} already exists (Role: ${existingUser.role}${existingUser.workletId ? ', Worklet: ' + existingUser.workletId : ''})`);
        continue;
      }

      // Create user
      const user = new User(userData);
      await user.save();
      
      console.log(`✅ Created ${userData.role} user:`);
      console.log(`📧 Email: ${userData.email}`);
      console.log(`🔑 Password: ${userData.password}`);
      console.log(`👤 Role: ${userData.role}`);
      if (userData.workletId) {
        console.log(`🔖 Worklet ID: ${userData.workletId}`);
      }
      console.log('---');
    }

    console.log('\n💡 You can now use these credentials to test different user roles');

  } catch (error) {
    console.error('❌ Error creating demo users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run the script - comment/uncomment as needed
// createAdminUser();
createDemoUsers();

import mongoose, { Schema } from 'mongoose';

export interface IProject extends mongoose.Document {
  workletId: string;
  workletTitle: string;
  domain: string;
  mentors: string[];
  students: string[];
  college: string;
  status: string;
  stage: string;
  professors: string[];
  
  // User association fields
  userEmails: string[]; // Array of student/professor emails
  userNames: string[];  // Array of student/professor names
  
  // Metadata
  sourceFile: mongoose.Types.ObjectId; // Reference to the uploaded Excel/CSV file
  uploadedBy: mongoose.Types.ObjectId; // Admin who uploaded the file
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>({
  workletId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  workletTitle: {
    type: String,
    required: true,
    trim: true
  },
  domain: {
    type: String,
    required: true,
    trim: true
  },
  mentors: [{
    type: String,
    trim: true
  }],
  students: [{
    type: String,
    trim: true
  }],
  college: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  stage: {
    type: String,
    required: true,
    trim: true
  },
  professors: [{
    type: String,
    trim: true
  }],
  userEmails: [{
    type: String,
    lowercase: true,
    trim: true,
    index: true
  }],
  userNames: [{
    type: String,
    trim: true,
    index: true
  }],
  sourceFile: {
    type: Schema.Types.ObjectId,
    ref: 'File',
    required: true,
    index: true
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient user-specific queries
projectSchema.index({ userEmails: 1, status: 1 });
projectSchema.index({ userNames: 1, stage: 1 });
projectSchema.index({ workletId: 1, userEmails: 1 });

// Text index for searching within project data
projectSchema.index({ 
  workletTitle: 'text', 
  domain: 'text', 
  college: 'text',
  mentors: 'text',
  students: 'text',
  professors: 'text'
});

export const Project = mongoose.model<IProject>('Project', projectSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface IFile extends Document {
  userId?: mongoose.Types.ObjectId; // Optional for system files
  originalName: string;
  filename: string;
  filePath: string;
  fileType: string;
  mimeType: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  uploadedAt: Date;
  processedAt?: Date;
  metadata?: {
    category?: string;
    description?: string;
    isSystemFile?: boolean;
  };
}

const fileSchema = new Schema<IFile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for system files
    index: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  filename: {
    type: String,
    required: true,
    unique: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true,
    enum: ['pdf', 'docx', 'xlsx', 'xls', 'txt', 'image', 'unknown']
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed'],
    default: 'uploading'
  },
  processingError: {
    type: String
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  metadata: {
    category: {
      type: String,
      default: 'general'
    },
    description: {
      type: String,
      default: ''
    },
    isSystemFile: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
fileSchema.index({ userId: 1, status: 1 });
fileSchema.index({ uploadedAt: -1 });

export const File = mongoose.model<IFile>('File', fileSchema);

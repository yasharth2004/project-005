import mongoose, { Schema } from 'mongoose';

export interface IDocument extends mongoose.Document {
  userId?: mongoose.Types.ObjectId; // Optional for system files
  fileId: mongoose.Types.ObjectId;
  content: string;
  chunkIndex: number;
  metadata: {
    source: string;
    page?: number;
    section?: string;
    tags: string[];
    fileName: string;
  };
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for system files
    index: true
  },
  fileId: {
    type: Schema.Types.ObjectId,
    ref: 'File',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000 // Limit chunk size
  },
  chunkIndex: {
    type: Number,
    required: true,
    min: 0
  },
  metadata: {
    source: {
      type: String,
      required: true
    },
    page: {
      type: Number,
      min: 1
    },
    section: {
      type: String
    },
    tags: [{
      type: String,
      trim: true
    }],
    fileName: {
      type: String,
      required: true
    }
  },
  embedding: [{
    type: Number
  }]
}, {
  timestamps: true
});

// Compound index for efficient user-specific queries
documentSchema.index({ userId: 1, fileId: 1, chunkIndex: 1 });
documentSchema.index({ userId: 1, 'metadata.tags': 1 });

// Text index for content search (if needed)
documentSchema.index({ content: 'text' });

export const Document = mongoose.model<IDocument>('Document', documentSchema);

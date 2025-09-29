import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { File, IFile } from '../models/File';
import { Document } from '../models/Document';
import { User, IUser } from '../models/User';
import { processAndSaveFile } from '../services/documentProcessor';
import { vectorStore } from '../services/vectorStore';
import fs from 'fs/promises';
import fsSync from 'fs';

// @desc    Upload system file (admin only)
// @route   POST /api/admin/files/upload
// @access  Private (Admin only)
export const uploadSystemFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { originalname, filename, mimetype, size } = req.file;
    const { category, description } = req.body; // category: 'program-info', 'credentials', 'faq', 'guidelines', 'synthetic-data', 'general', etc.

    // Determine file type
    let fileType: string;
    console.log('🔍 File upload - MIME type:', mimetype);
    console.log('🔍 File upload - Original name:', originalname);
    
    if (mimetype === 'application/pdf') {
      fileType = 'pdf';
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      fileType = 'docx';
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      fileType = 'xlsx';
    } else if (mimetype === 'application/vnd.ms-excel') {
      fileType = 'xls'; // Old Excel format
    } else if (mimetype === 'text/plain') {
      fileType = 'txt';
    } else if (mimetype.startsWith('image/')) {
      fileType = 'image';
    } else {
      fileType = 'unknown';
      console.log('⚠️ Unknown file type for:', mimetype);
    }
    
    console.log('🔍 File upload - Determined type:', fileType);

    // Create file record (no specific user - system-wide)
    const file = await File.create({
      userId: null, // System file - no specific user
      originalName: originalname,
      filename,
      filePath: req.file.path,
      fileType,
      mimeType: mimetype,
      size,
      status: 'uploading',
      metadata: {
        category: category || 'general',
        description: description || '',
        isSystemFile: true
      }
    }) as IFile;

    // Start background processing for document extraction
    const fileId = (file as any)._id.toString();
    console.log('🚀 Starting background processing for file:', fileId);
    
    // Process immediately and wait for completion to ensure RAG data is available
    processAndSaveFile(fileId)
      .then(() => {
        console.log('✅ File processing completed successfully for:', fileId);
      })
      .catch(error => {
        console.error('❌ Background processing error:', error);
      });

    res.status(201).json({
      success: true,
      data: {
        file: {
          id: file._id,
          originalName: file.originalName,
          filename: file.filename,
          fileType: file.fileType,
          category: file.metadata?.category,
          description: file.metadata?.description,
          size: file.size,
          status: file.status,
          uploadedAt: file.uploadedAt
        }
      }
    });
  } catch (error) {
    console.error('System file upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during file upload'
    });
  }
};

// @desc    Get all system files (admin only)
// @route   GET /api/admin/files
// @access  Private (Admin only)
export const getSystemFiles = async (req: Request, res: Response) => {
  try {
    const { category, status, page = 1, limit = 10 } = req.query;

    // Build query for system files
    const query: any = { userId: null };
    
    if (category) {
      query['metadata.category'] = category;
    }
    
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const files = await File.find(query)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .select('-filePath');

    const total = await File.countDocuments(query);

    // Map files to ensure consistent ID field
    const mappedFiles = files.map(file => ({
      id: (file as any)._id.toString(),
      _id: file._id,
      originalName: file.originalName,
      filename: file.filename,
      fileType: file.fileType,
      mimeType: file.mimeType,
      size: file.size,
      status: file.status,
      uploadedAt: file.uploadedAt,
      processedAt: file.processedAt,
      metadata: file.metadata
    }));

    res.json({
      success: true,
      data: {
        files: mappedFiles,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Get system files error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get system file statistics (admin only)
// @route   GET /api/admin/files/stats
// @access  Private (Admin only)
export const getSystemFileStats = async (req: Request, res: Response) => {
  try {
    const stats = await File.aggregate([
      { $match: { userId: null } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          byCategory: {
            $push: '$metadata.category'
          },
          byStatus: {
            $push: '$status'
          }
        }
      }
    ]);

    const categoryCounts = await File.aggregate([
      { $match: { userId: null } },
      {
        $group: {
          _id: '$metadata.category',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = await File.aggregate([
      { $match: { userId: null } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      totalFiles: stats[0]?.totalFiles || 0,
      totalSize: stats[0]?.totalSize || 0,
      categoryCounts: categoryCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as any),
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as any)
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get system file stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete system file (admin only)
// @route   DELETE /api/admin/files/:id
// @access  Private (Admin only)
export const deleteSystemFile = async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    console.log('🗑️ Attempting to delete file:', fileId);

    // Validate ObjectId format
    if (!fileId || !fileId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ Invalid file ID format:', fileId);
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID format'
      });
    }

    const file = await File.findOne({ _id: fileId, userId: null });
    
    if (!file) {
      console.log('❌ File not found:', fileId);
      return res.status(404).json({
        success: false,
        error: 'System file not found'
      });
    }

    console.log('📁 Found file to delete:', file.originalName);
    console.log('📁 File path:', file.filePath);

    // Delete physical file
    try {
      if (file.filePath && fsSync.existsSync(file.filePath)) {
        await fs.unlink(file.filePath);
        console.log('✅ Physical file deleted');
      } else {
        console.log('⚠️ Physical file not found at path:', file.filePath);
      }
    } catch (unlinkError) {
      console.warn('Could not delete physical file:', unlinkError);
    }

    // Remove embeddings from vector store
    try {
      await vectorStore.removeEmbeddingsForFile(fileId);
      console.log('✅ Embeddings removed from vector store');
    } catch (embeddingError) {
      console.warn('⚠️ Warning: Could not remove embeddings from vector store:', embeddingError);
      // Continue with deletion even if embedding removal fails
    }

    // Delete associated documents
    const deletedDocs = await Document.deleteMany({ fileId });
    console.log('📚 Deleted documents:', deletedDocs.deletedCount);

    // Delete file record
    await File.findByIdAndDelete(fileId);
    console.log('✅ File record deleted from database');

    res.json({
      success: true,
      data: { message: 'System file deleted successfully' }
    });
  } catch (error) {
    console.error('Delete system file error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during file deletion'
    });
  }
};

// @desc    Get all users (admin only)
// @route   GET /api/admin/users
// @access  Private (Admin only)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, role } = req.query;

    // Build query
    const query: any = {};
    if (role) {
      query.role = role;
    }

    // Pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get user details (admin only)
// @route   GET /api/admin/users/:id
// @access  Private (Admin only)
export const getUserDetails = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's project documents (if any)
    const userDocuments = await Document.find({ userId }).populate('fileId', 'originalName');

    res.json({
      success: true,
      data: {
        user,
        documents: userDocuments.map(doc => ({
          id: doc._id,
          content: doc.content,
          chunkIndex: doc.chunkIndex,
          fileName: (doc as any).fileId?.originalName || doc.metadata.fileName
        })),
        totalDocuments: userDocuments.length
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get embedding statistics (admin only)
// @route   GET /api/admin/embeddings/stats
// @access  Private (Admin only)
export const getEmbeddingStats = async (req: Request, res: Response) => {
  try {
    console.log('📊 Getting embedding statistics...');
    
    const stats = await vectorStore.getEmbeddingStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        embeddingCoverageFormatted: `${stats.embeddingCoverage.toFixed(1)}%`
      }
    });
  } catch (error) {
    console.error('Get embedding stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while getting embedding statistics'
    });
  }
};

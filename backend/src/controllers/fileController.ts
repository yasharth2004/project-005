import { Request, Response } from 'express';
import { File, IFile } from '../models/File';
import { Document } from '../models/Document';
import { vectorStore } from '../services/vectorStore';
import fs from 'fs/promises';
import path from 'path';
import { processAndSaveFile } from '../services/documentProcessor';

// @desc    Upload file
// @route   POST /api/files/upload
// @access  Private
export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const userId = req.user!._id;
    const { originalname, filename, mimetype, size } = req.file;

    // Determine file type
    let fileType: string;
    if (mimetype === 'application/pdf') {
      fileType = 'pdf';
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      fileType = 'docx';
    } else if (mimetype === 'text/plain') {
      fileType = 'txt';
    } else if (mimetype.startsWith('image/')) {
      fileType = 'image';
    } else {
      fileType = 'unknown';
    }

    // Create file record
    const file = await File.create({
      userId,
      originalName: originalname,
      filename,
      filePath: req.file.path,
      fileType,
      mimeType: mimetype,
      size,
      status: 'uploading'
    }) as IFile;

    // Start background processing for document extraction
    const fileId = (file as any)._id.toString();
    processAndSaveFile(fileId).catch(error => {
      console.error('Background processing error:', error);
    });

    res.status(201).json({
      success: true,
      data: {
        file: {
          id: file._id,
          originalName: file.originalName,
          filename: file.filename,
          fileType: file.fileType,
          size: file.size,
          status: file.status,
          uploadedAt: file.uploadedAt
        }
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during file upload'
    });
  }
};

// @desc    Get user's files
// @route   GET /api/files
// @access  Private
export const getUserFiles = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { status, fileType, page = 1, limit = 10 } = req.query;

    // Build query
    const query: any = { userId };
    
    if (status) {
      query.status = status;
    }
    
    if (fileType) {
      query.fileType = fileType;
    }

    // Pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const files = await File.find(query)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .select('-filePath');

    const total = await File.countDocuments(query);

    res.json({
      success: true,
      data: {
        files,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get single file
// @route   GET /api/files/:id
// @access  Private
export const getFile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const fileId = req.params.id;

    const file = await File.findOne({ _id: fileId, userId }).select('-filePath');
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    res.json({
      success: true,
      data: { file }
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete file
// @route   DELETE /api/files/:id
// @access  Private
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const fileId = req.params.id;

    const file = await File.findOne({ _id: fileId, userId });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    console.log(`🗑️ Deleting file: ${file.originalName}`);
    
    // Delete physical file
    try {
      await fs.unlink(file.filePath);
      console.log('✅ Physical file deleted');
    } catch (unlinkError) {
      console.warn('⚠️ Could not delete physical file:', unlinkError);
    }

    // Remove embeddings from vector store
    try {
      await vectorStore.removeEmbeddingsForFile(fileId);
      console.log('✅ Embeddings removed from vector store');
    } catch (embeddingError) {
      console.warn('⚠️ Warning: Could not remove embeddings from vector store:', embeddingError);
      // Continue with deletion even if embedding removal fails
    }

    // Delete associated documents from Document collection
    const deletedDocs = await Document.deleteMany({ fileId });
    console.log(`📚 Deleted ${deletedDocs.deletedCount} document chunks`);

    // Delete file record
    await File.findByIdAndDelete(fileId);
    console.log('✅ File record deleted from database');

    res.json({
      success: true,
      data: { message: 'File deleted successfully' }
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during file deletion'
    });
  }
};

// @desc    Get file statistics
// @route   GET /api/files/stats
// @access  Private
export const getFileStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;

    const stats = await File.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          byStatus: {
            $push: '$status'
          },
          byType: {
            $push: '$fileType'
          }
        }
      }
    ]);

    const statusCounts = await File.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const typeCounts = await File.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$fileType',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      totalFiles: stats[0]?.totalFiles || 0,
      totalSize: stats[0]?.totalSize || 0,
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as any),
      typeCounts: typeCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as any)
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get file stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

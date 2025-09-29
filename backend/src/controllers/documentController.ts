import { Request, Response } from 'express';
import { Document, IDocument } from '../models/Document';
import { File, IFile } from '../models/File';

// Enhanced text similarity function
const calculateSimilarity = (query: string, content: string): number => {
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const contentLower = content.toLowerCase();
  
  if (queryWords.length === 0) return 0;
  
  let matches = 0;
  queryWords.forEach(word => {
    if (contentLower.includes(word)) {
      matches++;
    }
  });
  
  return matches / queryWords.length;
};

// @desc    Search user's documents (user-specific only)
// @route   GET /api/documents/search
// @access  Private
export const searchDocuments = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { q: query, limit = 5 } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    console.log('🔍 Searching documents for user:', userId);
    console.log('🔍 Query:', query);

    // Get both user-specific documents AND system files (admin uploaded)
    const documents = await Document.find({
      $or: [
        { userId: userId },      // User's own documents
        { userId: null }         // System files (admin uploaded)
      ]
    }).populate('fileId', 'originalName');

    console.log(`📚 Found ${documents.length} total documents to search through`);
    console.log(`📚 User documents: ${documents.filter(d => d.userId && d.userId.toString() === (userId as any).toString()).length}`);
    console.log(`📚 System documents: ${documents.filter(d => !d.userId).length}`);

    if (documents.length === 0) {
      console.log('⚠️ No documents found in database');
      return res.json({
        success: true,
        data: {
          results: [],
          total: 0,
          query
        }
      });
    }

    // Calculate similarity scores
    const scoredDocuments = documents.map(doc => {
      const score = calculateSimilarity(query, doc.content);
      return {
        document: doc,
        relevanceScore: score
      };
    });

    console.log('📈 Relevance scores:');
    scoredDocuments.forEach((result, index) => {
      if (index < 5) { // Show first 5 scores for debugging
        console.log(`  ${index + 1}. Score: ${result.relevanceScore.toFixed(3)} - "${result.document.content.substring(0, 50)}..."`);
      }
    });

    // Filter and sort by relevance (lowered threshold)
    const results = scoredDocuments
      .filter(result => result.relevanceScore > 0.0) // Lower threshold to 0.0 to get all matches
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, parseInt(limit as string))
      .map(result => ({
        id: result.document._id,
        content: result.document.content,
        chunkIndex: result.document.chunkIndex,
        relevanceScore: result.relevanceScore,
        metadata: {
          ...result.document.metadata,
          fileName: (result.document as any).fileId?.originalName || result.document.metadata.fileName
        }
      }));

    console.log(`✅ Found ${results.length} relevant user documents`);

    res.json({
      success: true,
      data: {
        documents: results,  // Changed from 'results' to 'documents' to match expected format
        results,             // Keep both for compatibility
        total: results.length,
        query
      }
    });

  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during document search'
    });
  }
};

// @desc    Get documents for a specific file
// @route   GET /api/documents/:fileId
// @access  Private
export const getDocumentsForFile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const fileId = req.params.fileId;

    // Verify the file belongs to the user
    const file = await File.findOne({ _id: fileId, userId });
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Get documents for this file
    const documents = await Document.find({ userId, fileId })
      .sort({ chunkIndex: 1 });

    res.json({
      success: true,
      data: {
        file: {
          id: file._id,
          originalName: file.originalName,
          fileType: file.fileType,
          status: file.status,
          uploadedAt: file.uploadedAt,
          processedAt: file.processedAt
        },
        documents: documents.map(doc => ({
          id: doc._id,
          content: doc.content,
          chunkIndex: doc.chunkIndex,
          metadata: doc.metadata
        })),
        totalChunks: documents.length
      }
    });

  } catch (error) {
    console.error('Get documents for file error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete all documents for a file
// @route   DELETE /api/documents/:fileId
// @access  Private
export const deleteDocumentsForFile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const fileId = req.params.fileId;

    // Verify the file belongs to the user
    const file = await File.findOne({ _id: fileId, userId });
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Delete all documents for this file
    const result = await Document.deleteMany({ userId, fileId });

    console.log(`🗑️ Deleted ${result.deletedCount} documents for file: ${fileId}`);

    res.json({
      success: true,
      data: {
        message: `Deleted ${result.deletedCount} documents`,
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error('Delete documents for file error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during document deletion'
    });
  }
};

// @desc    Get document statistics for user
// @route   GET /api/documents/stats
// @access  Private
export const getDocumentStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;

    const stats = await Document.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          totalChunks: { $sum: 1 },
          totalContentLength: { $sum: { $strLenCP: '$content' } },
          byFile: {
            $push: '$fileId'
          }
        }
      }
    ]);

    const fileStats = await Document.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$fileId',
          chunkCount: { $sum: 1 },
          totalLength: { $sum: { $strLenCP: '$content' } }
        }
      },
      {
        $lookup: {
          from: 'files',
          localField: '_id',
          foreignField: '_id',
          as: 'file'
        }
      },
      {
        $unwind: '$file'
      }
    ]);

    const result = {
      totalDocuments: stats[0]?.totalDocuments || 0,
      totalChunks: stats[0]?.totalChunks || 0,
      totalContentLength: stats[0]?.totalContentLength || 0,
      uniqueFiles: stats[0]?.byFile ? new Set(stats[0].byFile).size : 0,
      fileStats: fileStats.map(stat => ({
        fileId: stat._id,
        fileName: stat.file.originalName,
        chunkCount: stat.chunkCount,
        totalLength: stat.totalLength
      }))
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get document stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

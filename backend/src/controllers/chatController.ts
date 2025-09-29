import { Request, Response } from 'express';
import { generateRAGResponse } from '../services/ragService';

// @desc    Generate chat response using RAG
// @route   POST /api/chat/generate
// @access  Private
export const generateChatResponse = async (req: Request, res: Response) => {
  try {
    const userId = (req.user!._id as any).toString();
    const { query, limit = 5 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    console.log('💬 Chat request received:', {
      userId,
      query,
      limit
    });

    // Generate RAG response
    const ragResponse = await generateRAGResponse(userId, query, limit);

    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        sources: ragResponse.sources,
        query: ragResponse.query,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error generating chat response:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during response generation'
    });
  }
};

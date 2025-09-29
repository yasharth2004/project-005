import express from 'express';
import { generateChatResponse } from '../controllers/chatController';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes are protected
router.use(protect);

// Generate chat response using RAG
router.post('/generate', generateChatResponse);

export default router;

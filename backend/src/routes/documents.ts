import express from 'express';
import { 
  searchDocuments, 
  getDocumentsForFile, 
  deleteDocumentsForFile,
  getDocumentStats
} from '../controllers/documentController';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes are protected
router.use(protect);

// Document search
router.get('/search', searchDocuments);

// Document statistics
router.get('/stats', getDocumentStats);

// Get documents for a specific file
router.get('/:fileId', getDocumentsForFile);

// Delete all documents for a file
router.delete('/:fileId', deleteDocumentsForFile);

export default router;

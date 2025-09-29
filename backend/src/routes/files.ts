import express from 'express';
import { 
  getUserFiles, 
  getFile, 
  deleteFile, 
  getFileStats 
} from '../controllers/fileController';
import { protect } from '../middleware/auth';


const router = express.Router();

// All routes are protected
router.use(protect);

// Get user's files (read-only access)
router.get('/', getUserFiles);

// Get file statistics
router.get('/stats', getFileStats);

// Get single file
router.get('/:id', getFile);

// Note: File upload and deletion removed for regular users
// Only admins can manage files via /api/admin/files

export default router;

import express from 'express';
import { 
  uploadSystemFile,
  getSystemFiles,
  getSystemFileStats,
  deleteSystemFile,
  getAllUsers,
  getUserDetails,
  getEmbeddingStats
} from '../controllers/adminController';
import { protect, authorize } from '../middleware/auth';
import { uploadSingle, handleUploadError } from '../middleware/upload';

const router = express.Router();

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// System file management
router.post('/files/upload', uploadSingle, handleUploadError, uploadSystemFile);
router.get('/files', getSystemFiles);
router.get('/files/stats', getSystemFileStats);
router.delete('/files/:id', deleteSystemFile);

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);

// Embedding management
router.get('/embeddings/stats', getEmbeddingStats);

export default router;

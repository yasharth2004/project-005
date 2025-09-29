# Samsung PRISM Backend

Backend API for the Samsung PRISM RAG Chatbot with user authentication and file management.

## Features

- **User Authentication**: JWT-based authentication with user registration and login
- **Admin System**: Role-based access control with admin and user roles
- **System File Management**: Admin-only file upload for program information, credentials, and FAQs
- **Document Processing**: Extract and store document chunks for RAG functionality
  - Support for PDF, DOCX, TXT, and image files (OCR)
  - Automatic text extraction and chunking
  - System-wide and user-specific document storage
- **RAG System**: Retrieval-Augmented Generation with Ollama integration
  - Search through system files and user documents
  - Context-aware AI responses
  - Source attribution
- **User Project Access**: Users can access their specific project details
- **Security**: Password hashing, CORS protection, and input validation
- **Database**: MongoDB with Mongoose ODM

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- npm or yarn
- Ollama (for AI model inference)
  - Install from: https://ollama.ai/
  - Run: `ollama pull phi` to download the Phi-2 model
  - Run: `ollama serve` to start the Ollama server

## Installation

1. **Clone the repository and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/samsung-prism
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Create admin user**
   ```bash
   node create-admin.js
   ```
   This creates an admin user with:
   - Email: admin@prism.com
   - Password: admin123

## Development

**Start development server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (protected)
- `PUT /api/auth/profile` - Update user profile (protected)

### File Management (User)
- `GET /api/files` - List user's files (protected, read-only)
- `GET /api/files/:id` - Get specific file (protected, read-only)
- `GET /api/files/stats` - Get file statistics (protected)

### Admin Management
- `POST /api/admin/files/upload` - Upload system file (admin only)
- `GET /api/admin/files` - List system files (admin only)
- `GET /api/admin/files/stats` - Get system file statistics (admin only)
- `DELETE /api/admin/files/:id` - Delete system file (admin only)
- `GET /api/admin/users` - List all users (admin only)
- `GET /api/admin/users/:id` - Get user details (admin only)

### Documents
- `GET /api/documents/search?q=query&limit=5` - Search user's documents (protected)
- `GET /api/documents/:fileId` - Get documents for a specific file (protected)
- `DELETE /api/documents/:fileId` - Delete documents for a file (protected)
- `GET /api/documents/stats` - Get document statistics for user (protected)

### Chat
- `POST /api/chat/generate` - Generate responses using RAG (protected)

## File Upload

Supported file types:
- PDF (.pdf)
- Word documents (.docx)
- Text files (.txt)
- Images (.jpg, .jpeg, .png, .gif)

Maximum file size: 10MB

## Database Schema

### Users
- `email` (unique)
- `password` (hashed)
- `name`
- `role` (user/admin)
- `isActive`
- `lastLogin`
- `createdAt`, `updatedAt`

### Files
- `userId` (reference to User)
- `originalName`
- `filename` (unique)
- `filePath`
- `fileType`
- `mimeType`
- `size`
- `status` (uploading/processing/completed/failed)
- `uploadedAt`, `processedAt`

### Documents
- `userId` (reference to User)
- `fileId` (reference to File)
- `content`
- `chunkIndex`
- `metadata` (source, page, section, tags, fileName)
- `embedding` (for vector search)

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- CORS protection
- Input validation and sanitization
- File type and size validation
- User-specific data access control

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/samsung-prism |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:5173 |
| `MAX_FILE_SIZE` | Maximum file size in bytes | 10485760 (10MB) |
| `BCRYPT_ROUNDS` | Password hashing rounds | 12 |

## Next Steps

1. ✅ Implement document processing service
2. ✅ Add RAG functionality with Ollama integration
3. ✅ Implement admin-based file management
4. Add vector search for better similarity matching
5. Add file processing background jobs
6. Implement real-time chat functionality

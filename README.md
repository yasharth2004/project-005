# Samsung PRISM RAG Chatbot

A comprehensive AI-powered chatbot system for the Samsung PRISM (PRogram for Innovation and Student Mentorship) program, featuring Retrieval-Augmented Generation (RAG) technology with admin-based file management and user-specific project access.

## 🚀 Features

### Core Functionality
- **AI-Powered Chatbot**: Context-aware responses using Microsoft Phi-2 model via Ollama
- **RAG System**: Retrieval-Augmented Generation for accurate, source-based answers
- **Admin-Based File Management**: Secure system file upload and management
- **User Authentication**: JWT-based authentication with role-based access control
- **Document Processing**: Support for PDF, DOCX, TXT, and image files (OCR)
- **Real-time Chat Interface**: Modern, responsive chat UI

### Admin Features
- **System File Upload**: Upload program information, credentials, FAQs, and guidelines
- **File Categorization**: Organize files by type (program-info, credentials, faq, etc.)
- **User Management**: View and manage all registered users
- **System Statistics**: Monitor file uploads, processing status, and usage metrics
- **Document Processing**: Automatic text extraction and chunking for RAG

### User Features
- **Program Information Access**: Get answers about Samsung PRISM program
- **Project-Specific Access**: Access personal project details and information
- **Chat Interface**: Natural language interaction with the AI assistant
- **Source Attribution**: View sources used for AI responses
- **Document Viewer**: Browse relevant documents and sources

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for modern, responsive styling
- **Zustand** for state management
- **React Router** for navigation
- **Axios** for API communication

### Backend (Node.js + Express + TypeScript)
- **Express.js** with TypeScript for robust API development
- **MongoDB** with Mongoose ODM for data persistence
- **JWT** for secure authentication
- **Multer** for file upload handling
- **Bcrypt** for password hashing
- **CORS & Helmet** for security

### AI/ML Stack
- **Ollama** for local AI model serving
- **Microsoft Phi-2** for natural language generation
- **Tesseract.js** for OCR (image text extraction)
- **PDF.js** for PDF text extraction
- **Mammoth.js** for DOCX text extraction

## 📋 Prerequisites

### System Requirements
- Node.js 18+ 
- MongoDB 6+
- Ollama with Microsoft Phi-2 model

### Install Ollama and Phi-2
```bash
# Install Ollama (macOS)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull Microsoft Phi-2 model
ollama pull phi

# Start Ollama server
ollama serve
```

## 🛠️ Installation

### 1. Clone and Setup
```bash
git clone <repository-url>
cd samsung-prism-rag-chatbot
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your configuration

# Start MongoDB (if not running)
mongod

# Create admin user
node create-admin.js

# Start development server
npm run dev
```

### 3. Frontend Setup
```bash
# From project root
npm install

# Start development server
npm run dev
```

### 4. Environment Configuration

**Backend (.env)**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/samsung-prism
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
BCRYPT_ROUNDS=12
```

## 🚀 Usage

### Admin Workflow
1. **Login as Admin**: Use `admin@prism.com / admin123`
2. **Upload System Files**: Navigate to Admin Dashboard
3. **Categorize Files**: Select appropriate category (program-info, credentials, faq, etc.)
4. **Monitor Processing**: Check file processing status
5. **Manage Users**: View and manage registered users

### User Workflow
1. **Register/Login**: Create account or login with existing credentials
2. **Access Chat**: Start chatting with the AI assistant
3. **Ask Questions**: Get information about Samsung PRISM program
4. **View Sources**: See which documents were used for responses
5. **Access Project Details**: View personal project information

### Example Queries
- "What is Samsung PRISM program?"
- "What are the eligibility requirements?"
- "How do I apply for the program?"
- "What are the benefits of joining PRISM?"
- "Tell me about the mentorship opportunities"

## 📁 Project Structure

```
samsung-prism-rag-chatbot/
├── src/                          # Frontend source
│   ├── components/               # React components
│   │   ├── AdminDashboard.tsx    # Admin interface
│   │   ├── ChatInterface.tsx     # Chat component
│   │   ├── DocumentViewer.tsx    # Document display
│   │   └── ...
│   ├── pages/                    # Page components
│   ├── services/                 # API services
│   ├── store/                    # State management
│   ├── types/                    # TypeScript types
│   └── utils/                    # Utility functions
├── backend/                      # Backend source
│   ├── src/
│   │   ├── controllers/          # API controllers
│   │   ├── middleware/           # Express middleware
│   │   ├── models/               # Mongoose models
│   │   ├── routes/               # API routes
│   │   ├── services/             # Business logic
│   │   └── utils/                # Utility functions
│   ├── uploads/                  # File upload directory
│   └── ...
└── ...
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Admin Management
- `POST /api/admin/files/upload` - Upload system file
- `GET /api/admin/files` - List system files
- `GET /api/admin/files/stats` - System file statistics
- `DELETE /api/admin/files/:id` - Delete system file
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user details

### User Features
- `GET /api/files` - List user files (read-only)
- `GET /api/files/:id` - Get specific file
- `GET /api/files/stats` - File statistics

### Chat & Documents
- `POST /api/chat/generate` - Generate RAG response
- `GET /api/documents/search` - Search documents
- `GET /api/documents/stats` - Document statistics

## 🧪 Testing

### Run Integration Tests
```bash
# Test complete system
node test-integration.js

# Test backend only
cd backend
node test-admin.js
node test-rag.js
```

### Manual Testing
1. **Start both servers**:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   npm run dev
   ```

2. **Test Admin Features**:
   - Login: `admin@prism.com / admin123`
   - Upload test files
   - Check processing status

3. **Test User Features**:
   - Register new user
   - Chat with AI assistant
   - Verify RAG responses

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt with configurable rounds
- **Role-Based Access**: Admin and user role separation
- **CORS Protection**: Configured for frontend-backend communication
- **Input Validation**: Comprehensive request validation
- **File Upload Security**: Type and size restrictions
- **User Isolation**: Users can only access their own data

## 🚀 Deployment

### Backend Deployment
```bash
cd backend
npm run build
npm start
```

### Frontend Deployment
```bash
npm run build
# Deploy dist/ folder to your hosting service
```

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
FRONTEND_URL=your-production-frontend-url
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Samsung Electronics** for the PRISM program
- **Microsoft** for the Phi-2 model
- **Ollama** for local AI model serving
- **OpenAI** for RAG concept inspiration

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Built with ❤️ for Samsung PRISM Program**

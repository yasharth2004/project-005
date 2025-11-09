# Samsung PRISM RAG Chatbot - Complete System Workflow

## 🎯 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                         │
│                     (React + TypeScript + Vite)                      │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓↑
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                            │
│                    (Express.js REST API + JWT)                       │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓↑
┌─────────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                            │
│          (Controllers + Services + RAG Processing)                   │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓↑
┌──────────────────┬──────────────────┬──────────────────────────────┐
│   MongoDB        │   Ollama (AI)    │   Vector Store              │
│   Database       │   Phi-2 Model    │   (Embeddings)              │
└──────────────────┴──────────────────┴──────────────────────────────┘
```

---

## 📋 Complete User Journey Workflows

### 1️⃣ **New User Registration Flow (Student)**

```
START
  │
  ├─> User visits /signup
  │
  ├─> Step 1: Role Selection
  │   ├─> User selects "Student" role
  │   └─> Proceeds to details form
  │
  ├─> Step 2: Basic Information
  │   ├─> Enter: Name, Email, Password
  │   ├─> Frontend validation (email format, password match)
  │   └─> Proceeds to worklet validation
  │
  ├─> Step 3: Worklet Validation
  │   ├─> User enters Worklet ID
  │   ├─> POST /api/auth/validate-worklet
  │   │   ├─> Backend searches MongoDB for worklet
  │   │   ├─> If found: Returns worklet details
  │   │   └─> If not found: Returns error
  │   └─> Displays worklet information
  │
  ├─> Step 4: Account Creation
  │   ├─> POST /api/auth/signup
  │   │   ├─> Validate all inputs
  │   │   ├─> Hash password (bcrypt)
  │   │   ├─> Create User document in MongoDB
  │   │   ├─> Generate JWT token
  │   │   └─> Return user data + token
  │   └─> Store token in localStorage
  │
  └─> Redirect to / (Home Page)
      └─> User is logged in
```

### 2️⃣ **Admin Registration Flow**

```
START
  │
  ├─> User visits /signup
  │
  ├─> Step 1: Role Selection
  │   └─> User selects "Admin" role
  │
  ├─> Step 2: Basic Information
  │   ├─> Enter: Name, Email, Password
  │   ├─> Frontend validation
  │   └─> Skip worklet validation (not required)
  │
  ├─> Step 3: Account Creation
  │   ├─> POST /api/auth/signup
  │   │   └─> Same process as student (without worklet)
  │   └─> Store token
  │
  └─> Redirect to /
      └─> Access to Admin Dashboard
```

### 3️⃣ **Login Flow**

```
START
  │
  ├─> User visits /login
  │
  ├─> Enter credentials (email + password)
  │
  ├─> POST /api/auth/login
  │   ├─> Find user by email in MongoDB
  │   ├─> Compare password (bcrypt)
  │   ├─> If valid:
  │   │   ├─> Update lastLogin timestamp
  │   │   ├─> Generate JWT token
  │   │   └─> Return user data + token
  │   └─> If invalid: Return 401 error
  │
  ├─> Store token in localStorage
  │
  └─> Redirect to /
      ├─> If Student: Access chat + worklet data
      └─> If Admin: Access dashboard + admin tools
```

---

## 💬 Chat/RAG Interaction Flow (MOST IMPORTANT)

### 4️⃣ **Student Asks a Question (Worklet-Aware)**

```
START: Student types question in chat
  │
  ├─> Frontend: POST /api/chat/generate
  │   └─> Headers: Authorization Bearer <JWT_TOKEN>
  │   └─> Body: { message: "user question" }
  │
  ├─> Backend: chatController.generateResponse()
  │   │
  │   ├─> Step 1: Authentication
  │   │   ├─> Verify JWT token
  │   │   ├─> Extract userId from token
  │   │   └─> Fetch user from MongoDB
  │   │
  │   ├─> Step 2: Query Classification
  │   │   ├─> Analyze query text
  │   │   ├─> Determine query type:
  │   │   │   ├─> General Program Query?
  │   │   │   │   └─> "What is Samsung PRISM?"
  │   │   │   │   └─> "How to apply?"
  │   │   │   │
  │   │   │   ├─> Personal Worklet Query?
  │   │   │   │   └─> "Tell me about my worklet"
  │   │   │   │   └─> "My project details"
  │   │   │   │
  │   │   │   └─> Specific Worklet Query?
  │   │   │       └─> "Details about worklet 025"
  │   │   │
  │   │   └─> Set query flags:
  │   │       ├─> isGeneralProgramQuery
  │   │       ├─> isPersonalWorkletQuery
  │   │       └─> isSpecificWorkletQuery
  │   │
  │   ├─> Step 3: Privacy Protection (Students)
  │   │   ├─> If asking about OTHER worklet:
  │   │   │   └─> Return privacy protection message
  │   │   │   └─> STOP (don't process further)
  │   │   │
  │   │   └─> If asking about OWN worklet:
  │   │       └─> Continue processing
  │   │
  │   ├─> Step 4: Document Search (PARALLEL)
  │   │   │
  │   │   ├─> Branch A: Vector Search
  │   │   │   ├─> Generate query embedding
  │   │   │   ├─> Search vector store
  │   │   │   ├─> Find similar document chunks
  │   │   │   └─> Return top 3-5 matches
  │   │   │
  │   │   ├─> Branch B: Project/Worklet Search
  │   │   │   ├─> If isGeneralProgramQuery:
  │   │   │   │   └─> Skip project search
  │   │   │   │
  │   │   │   └─> If worklet-specific query:
  │   │   │       ├─> Search Project collection
  │   │   │       ├─> Filter by workletId
  │   │   │       └─> Return matching projects
  │   │   │
  │   │   └─> Results combined:
  │   │       ├─> relevantDocs[] (from vector search)
  │   │       └─> projectResults[] (from project search)
  │   │
  │   ├─> Step 5: Context Building
  │   │   ├─> Take top 3 relevant documents
  │   │   ├─> Add worklet-specific info (if student)
  │   │   ├─> Format context string
  │   │   ├─> Limit context to 1200 chars (Phi-2 limit)
  │   │   └─> Build prompt:
  │   │       "Context: [documents + worklet info]
  │   │        Question: [user query]
  │   │        Answer:"
  │   │
  │   ├─> Step 6: AI Generation (Ollama)
  │   │   ├─> POST to http://localhost:11434/api/generate
  │   │   ├─> Model: phi:latest (Phi-2, 2.7B params)
  │   │   ├─> Parameters:
  │   │   │   ├─> temperature: 0.7
  │   │   │   ├─> top_p: 0.9
  │   │   │   ├─> num_predict: 250 tokens
  │   │   │   └─> repeat_penalty: 1.1
  │   │   │
  │   │   ├─> Ollama processes:
  │   │   │   ├─> Load Phi-2 model
  │   │   │   ├─> Generate response
  │   │   │   └─> Return AI text
  │   │   │
  │   │   └─> Response generated (2-8 seconds)
  │   │
  │   └─> Step 7: Return Response
  │       ├─> Format response object:
  │       │   ├─> response: "AI generated text"
  │       │   ├─> sources: [documents used]
  │       │   └─> metadata: {time, sources count}
  │       │
  │       └─> Send JSON to frontend
  │
  └─> Frontend receives response
      ├─> Display AI message in chat
      ├─> Show source documents
      └─> User can ask follow-up question
```

---

## 👑 Admin Workflows

### 5️⃣ **Admin Uploads System File**

```
START: Admin clicks "Upload File"
  │
  ├─> Select file (PDF/DOCX/TXT/Image)
  │
  ├─> Select category:
  │   ├─> program-info
  │   ├─> credentials
  │   ├─> faq
  │   ├─> guidelines
  │   └─> other
  │
  ├─> POST /api/admin/files/upload
  │   ├─> Multer middleware: Save to /uploads
  │   ├─> Create File record in MongoDB
  │   └─> Trigger document processing
  │
  ├─> Document Processing Service:
  │   │
  │   ├─> Step 1: Text Extraction
  │   │   ├─> PDF: Use pdf-parse
  │   │   ├─> DOCX: Use mammoth
  │   │   ├─> TXT: Read directly
  │   │   └─> Images: Use Tesseract OCR
  │   │
  │   ├─> Step 2: Text Chunking
  │   │   ├─> Split into 500-char chunks
  │   │   ├─> Overlap: 50 chars
  │   │   └─> Create Document chunks
  │   │
  │   ├─> Step 3: Embedding Generation
  │   │   ├─> For each chunk:
  │   │   │   ├─> Generate vector embedding
  │   │   │   │   (Xenova/all-MiniLM-L6-v2)
  │   │   │   └─> Store in vector store
  │   │   │
  │   │   └─> Save Document to MongoDB:
  │   │       ├─> userId: null (system file)
  │   │       ├─> fileId: reference
  │   │       ├─> content: text
  │   │       ├─> chunks: [embeddings]
  │   │       └─> processed: true
  │   │
  │   └─> Update File status: "processed"
  │
  └─> Admin sees success message
      └─> File is now searchable in RAG
```

### 6️⃣ **Admin Views User List**

```
START: Admin clicks "Users" tab
  │
  ├─> GET /api/admin/users
  │   ├─> Verify admin role
  │   ├─> Query MongoDB User collection
  │   ├─> Filter, sort, paginate
  │   └─> Return user list
  │
  └─> Display table:
      ├─> Name, Email, Role
      ├─> Worklet ID (for students)
      ├─> Registration date
      └─> Last login time
```

---

## 🎨 Theme System Workflow

### 7️⃣ **User Toggles Theme**

```
START: User clicks theme toggle button
  │
  ├─> ThemeContext.toggleTheme()
  │   ├─> Read current theme from state
  │   ├─> Toggle: light ↔ dark
  │   ├─> Update React state
  │   └─> Save to localStorage
  │
  ├─> Update DOM:
  │   ├─> Set data-theme attribute on <body>
  │   │   └─> <body data-theme="dark">
  │   │
  │   └─> CSS automatically applies:
  │       └─> [data-theme="dark"] { ... }
  │
  └─> UI re-renders with new theme
      ├─> All components update colors
      └─> Theme persists across sessions
```

---

## 🔍 Advanced RAG Features

### 8️⃣ **Worklet-Specific Search (Student)**

```
Query: "What are my project requirements?"
  │
  ├─> Classification: Personal Worklet Query
  │
  ├─> Get student's workletId: "025"
  │
  ├─> Enhanced Search Strategy:
  │   │
  │   ├─> Search 1: Vector search with context
  │   │   └─> Query: "project requirements worklet:025"
  │   │
  │   ├─> Search 2: Project collection
  │   │   └─> Filter: { workletId: "025" }
  │   │
  │   └─> Search 3: Worklet-specific documents
  │       └─> Filter: { workletId: "025", type: "requirements" }
  │
  ├─> Combine results:
  │   ├─> Worklet documents (highest priority)
  │   ├─> Project details
  │   └─> General program documents
  │
  └─> Generate personalized response:
      └─> "For your worklet 025 (IoT Smart Home), 
           the requirements are..."
```

### 9️⃣ **General Program Query (Any User)**

```
Query: "What is Samsung PRISM?"
  │
  ├─> Classification: General Program Query
  │
  ├─> Simplified Search:
  │   ├─> Only search system documents
  │   ├─> Skip worklet filtering
  │   └─> Skip project search (faster)
  │
  ├─> Context: Program information docs only
  │
  └─> Generate general response:
      └─> "Samsung PRISM is a Program for Innovation 
           and Student Mentorship..."
```

---

## 🔒 Security & Authentication Flow

### 🔐 **JWT Authentication Process**

```
Every Protected Request:
  │
  ├─> Frontend sends request
  │   └─> Header: Authorization: Bearer <JWT_TOKEN>
  │
  ├─> Backend auth middleware:
  │   ├─> Extract token from header
  │   ├─> Verify token signature (JWT_SECRET)
  │   ├─> Decode token payload:
  │   │   ├─> userId
  │   │   ├─> role
  │   │   └─> exp (expiration)
  │   │
  │   ├─> Check expiration
  │   │   └─> If expired: Return 401
  │   │
  │   ├─> Attach user to req.user
  │   └─> Call next()
  │
  └─> Controller executes with authenticated user
```

### 🛡️ **Role-Based Access Control**

```
Request to Admin Endpoint:
  │
  ├─> auth middleware: Verify JWT ✓
  │
  ├─> adminAuth middleware:
  │   ├─> Check req.user.role
  │   ├─> If role !== 'admin':
  │   │   └─> Return 403 Forbidden
  │   └─> If role === 'admin':
  │       └─> Allow access
  │
  └─> Execute admin controller
```

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│   Student   │
│   Browser   │
└──────┬──────┘
       │ 1. Question: "My worklet details?"
       ↓
┌──────────────────────────────────────┐
│         React Frontend               │
│  - ChatInterface component           │
│  - Sends POST /api/chat/generate     │
└──────┬───────────────────────────────┘
       │ 2. HTTP Request + JWT
       ↓
┌──────────────────────────────────────┐
│       Express.js Backend             │
│  - Middleware: JWT verification      │
│  - Controller: chatController        │
└──────┬───────────────────────────────┘
       │ 3. Extract userId & query
       ↓
┌──────────────────────────────────────┐
│      RAG Service (Core Logic)        │
│  - Query classification              │
│  - Privacy protection check          │
│  - Document search orchestration     │
└──────┬───────────────────────────────┘
       │ 4. Parallel searches
       ↓
┌──────────────┬───────────────┬────────────────┐
│   MongoDB    │ Vector Store  │ Project DB     │
│ (Documents)  │ (Embeddings)  │ (Worklets)     │
└──────┬───────┴───────┬───────┴────────┬───────┘
       │               │                │
       │ 5. Return relevant documents  │
       └───────────────┴────────────────┘
                       ↓
┌──────────────────────────────────────┐
│         Context Builder              │
│  - Combines docs + worklet info      │
│  - Formats prompt for AI             │
└──────┬───────────────────────────────┘
       │ 6. Prompt with context
       ↓
┌──────────────────────────────────────┐
│      Ollama (AI Service)             │
│  - Model: phi:latest (Phi-2)         │
│  - Generates natural language        │
└──────┬───────────────────────────────┘
       │ 7. AI Response
       ↓
┌──────────────────────────────────────┐
│       Response Formatter             │
│  - Add sources                       │
│  - Add metadata                      │
│  - Format JSON                       │
└──────┬───────────────────────────────┘
       │ 8. Complete response
       ↓
┌──────────────────────────────────────┐
│         React Frontend               │
│  - Display AI message                │
│  - Show sources                      │
│  - Ready for next question           │
└──────────────────────────────────────┘
```

---

## 🔄 Complete Request/Response Cycle

### Example: Student asks about their worklet

**Request:**
```json
POST /api/chat/generate
Headers: {
  "Authorization": "Bearer eyJhbGc...",
  "Content-Type": "application/json"
}
Body: {
  "message": "What are my project milestones?"
}
```

**Backend Processing:**
1. ✅ Verify JWT → userId: "abc123", role: "student", workletId: "025"
2. 🔍 Classify query → Personal Worklet Query
3. 🔐 Privacy check → Passed (own worklet)
4. 📚 Search documents → 3 relevant docs found
5. 📊 Search projects → 2 project milestones found
6. 🧩 Build context → 1200 chars
7. 🤖 Call Ollama → Generate response (3.2s)
8. 📦 Format response

**Response:**
```json
{
  "success": true,
  "response": "For your worklet 025 (IoT Smart Home System), here are your project milestones:\n\n1. Phase 1 (Weeks 1-4): Research and proposal\n2. Phase 2 (Weeks 5-8): System design\n3. Phase 3 (Weeks 9-12): Implementation\n4. Phase 4 (Weeks 13-16): Testing and documentation",
  "sources": [
    {
      "title": "Worklet 025 Guidelines",
      "filename": "worklet_025_guidelines.pdf",
      "type": "worklet-specific",
      "relevance": 0.92
    },
    {
      "title": "Project Timeline",
      "filename": "milestones.pdf",
      "type": "worklet-specific",
      "relevance": 0.87
    }
  ],
  "metadata": {
    "processingTime": 3245,
    "searchTime": 512,
    "ragTime": 2733,
    "sourcesUsed": 2,
    "model": "phi:latest"
  }
}
```

---

## 🎯 Key System Components Summary

### Frontend (React)
- **Entry Point**: `src/main.tsx` → `src/App.tsx`
- **Key Components**: 
  - `ChatInterface` - Main chat UI
  - `LoginForm` - Authentication
  - `SignupPage` - Registration flow
  - `AdminDashboard` - Admin tools
  - `ThemeToggle` - Dark/light mode

### Backend (Express.js)
- **Entry Point**: `backend/src/index.ts`
- **Key Routes**:
  - `/api/auth/*` - Authentication
  - `/api/chat/generate` - RAG processing
  - `/api/admin/*` - Admin operations
  - `/api/files/*` - File management

### Services (Business Logic)
- **ragService.ts** - Core RAG logic
- **vectorStore.ts** - Embedding search
- **projectSearchService.ts** - Worklet queries
- **workletService.ts** - Worklet management
- **documentProcessor.ts** - File processing

### Data Layer
- **MongoDB Collections**:
  - `users` - User accounts
  - `files` - Uploaded files
  - `documents` - Processed text chunks
  - `projects` - Worklet data

### AI Layer
- **Ollama** - Local AI server
- **Model**: phi:latest (Phi-2, 2.7B params)
- **Embeddings**: all-MiniLM-L6-v2

---

## 🚀 Performance Optimizations Applied

1. **Parallel Processing**: Document & project searches run simultaneously
2. **Query Classification**: Routes queries efficiently
3. **Smart Scoping**: Students search 3 docs, others search 5
4. **Privacy Protection**: Early return for unauthorized worklet queries
5. **Vector Search**: Fast embedding-based similarity
6. **Optimized Prompts**: Shorter context for faster generation
7. **Role-based Filtering**: Reduce search scope

---

**This workflow documentation provides a complete understanding of how the Samsung PRISM RAG Chatbot system operates from user interaction to AI response generation.**

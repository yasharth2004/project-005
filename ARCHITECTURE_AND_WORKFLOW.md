# Samsung PRISM RAG Chatbot — Architecture & Workflow

> **Project**: Samsung PRISM Intelligent Chatbot with Retrieval-Augmented Generation  
> **Stack**: React + TypeScript (Frontend) | Express + TypeScript (Backend) | MongoDB (Database) | Ollama/Phi (LLM) | Xenova Transformers (Embeddings)

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture](#4-backend-architecture)
5. [Database Schema](#5-database-schema)
6. [RAG Pipeline — Core Workflow](#6-rag-pipeline--core-workflow)
7. [Document Processing Pipeline](#7-document-processing-pipeline)
8. [Analytical Query Engine](#8-analytical-query-engine)
9. [Authentication & Authorization Flow](#9-authentication--authorization-flow)
10. [API Endpoints Reference](#10-api-endpoints-reference)
11. [File & Directory Structure](#11-file--directory-structure)
12. [Deployment Architecture](#12-deployment-architecture)

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                            │
│   React 18 + TypeScript + Vite + Tailwind CSS + Zustand          │
└──────────────┬───────────────────────────────────┬───────────────┘
               │  HTTP (Axios)                     │
               ▼                                   ▼
┌──────────────────────────┐         ┌────────────────────────────┐
│    Express.js Backend    │         │   Samsung PRISM Portal     │
│       (Port 5000)        │         │   https://srib.in/prismApp │
│                          │         └────────────────────────────┘
│  ┌────────────────────┐  │
│  │   Auth Middleware   │  │
│  │  (JWT + RBAC)       │  │
│  └────────┬───────────┘  │
│           ▼              │
│  ┌────────────────────┐  │
│  │   RAG Orchestrator  │  │──────────┐
│  │  (ragService.ts)    │  │          │
│  └──┬─────┬─────┬─────┘  │          │
│     │     │     │         │          ▼
│     ▼     ▼     ▼         │  ┌──────────────┐
│  ┌────┐┌────┐┌──────┐    │  │  Ollama LLM   │
│  │Vec ││Proj││Analyt│    │  │  (Phi model)   │
│  │Stor││Srch││ical  │    │  │  Port 11434    │
│  └──┬─┘└──┬─┘└──┬───┘    │  └──────────────┘
│     │     │     │         │
│     ▼     ▼     ▼         │
│  ┌────────────────────┐   │
│  │     MongoDB         │   │
│  │  (4 Collections)    │   │
│  │  users | files      │   │
│  │  documents|projects │   │
│  └────────────────────┘   │
└──────────────────────────┘

┌──────────────────────────┐
│   Xenova Transformers    │
│  all-MiniLM-L6-v2       │
│  (384-dim embeddings)    │
│  Runs locally in Node.js │
└──────────────────────────┘
```

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3 | UI framework |
| TypeScript | 5.5 | Type safety |
| Vite | 5.4 | Build tool & dev server |
| Tailwind CSS | 3.x | Utility-first styling |
| Zustand | 4.5 | State management (auth + chat stores) |
| Axios | — | HTTP client with JWT interceptors |
| React Router | 6.22 | Client-side routing |
| Lucide React | — | Icon library |
| React Markdown | — | Markdown rendering in chat |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Express.js | 4.18 | HTTP server framework |
| TypeScript | 5.3 | Type safety |
| Mongoose | 8.18 | MongoDB ODM |
| @xenova/transformers | 2.17 | Local sentence embeddings (all-MiniLM-L6-v2, 384 dim) |
| bcryptjs | — | Password hashing |
| jsonwebtoken | — | JWT authentication |
| multer | — | File upload handling |
| pdf-parse | — | PDF text extraction |
| mammoth | — | DOCX text extraction |
| ExcelJS | — | Excel parsing (project data + documents) |
| tesseract.js | 6.x | OCR for images |
| helmet | — | Security headers |
| cors | — | Cross-origin resource sharing |

### Infrastructure
| Component | Details |
|---|---|
| Database | MongoDB (localhost:27017/samsung-prism) |
| LLM | Ollama with `phi` model (localhost:11434) |
| Embedding Model | Xenova/all-MiniLM-L6-v2 (384 dimensions, local) |
| Model Cache | `backend/models-cache/Xenova/` |
| File Storage | `backend/uploads/` (disk-based via Multer) |
| Frontend Deploy | Vercel (static SPA) |

---

## 3. Frontend Architecture

### 3.1 Application Structure

```
src/
├── main.tsx                    # Entry point — mounts <App /> on #root
├── App.tsx                     # Root component + React Router setup
├── index.css                   # Global styles + Tailwind imports
│
├── components/
│   ├── AppLayout.tsx           # Shell — header, nav, footer, user dropdown
│   ├── ChatInterface.tsx       # Main chat UI — messages, file upload, sources sidebar
│   ├── ChatHistory.tsx         # Message list renderer
│   ├── ChatInput.tsx           # Input box + file attachment + send button
│   ├── ChatMessage.tsx         # Single message bubble (user/AI) with markdown
│   ├── DocumentViewer.tsx      # Related documents sidebar panel
│   ├── AdminDashboard.tsx      # Admin panel — file management, stats, user listing
│   ├── LoginForm.tsx           # Email/password login form
│   ├── ProtectedRoute.tsx      # Route guard — redirects unauthenticated to /login
│   └── ThemeToggle.tsx         # Light/dark mode toggle (Samsung brand colors)
│
├── pages/
│   ├── HomePage.tsx            # Chat page (wraps ChatInterface)
│   ├── AdminPage.tsx           # Admin page (wraps AdminDashboard)
│   ├── LoginPage.tsx           # Login page
│   └── SignupPage.tsx          # Signup page with role selection
│
├── services/
│   ├── api.ts                  # Axios instance + all API endpoint wrappers
│   ├── ragService.ts           # Frontend RAG orchestration (upload → generate)
│   ├── prismAuth.ts            # Samsung PRISM portal authentication service
│   └── prismApi.ts             # PRISM API client (placeholder)
│
├── store/
│   ├── authStore.ts            # Zustand — auth state (user, token, login/logout)
│   └── chatStore.ts            # Zustand — chat state (messages, sources, loading)
│
├── contexts/
│   └── ThemeContext.tsx         # Samsung Design System theme (light/dark)
│
├── types/
│   └── index.ts                # All TypeScript interfaces & types
│
└── utils/
    ├── authUtils.ts            # Auth helper functions
    ├── chatUtils.ts            # Chat formatting utilities
    └── fileProcessor.ts        # Client-side file handling
```

### 3.2 Routing

| Route | Component | Access |
|---|---|---|
| `/login` | LoginPage | Public |
| `/signup` | SignupPage | Public |
| `/` | HomePage (ChatInterface) | Protected (any authenticated user) |
| `/admin` | AdminPage (AdminDashboard) | Protected (admin role only) |
| `*` | Redirect → `/` | — |

### 3.3 State Management

**Auth Store** (Zustand with `persist` middleware):
- Persists `user` + `isAuthenticated` to `localStorage('auth-storage')`
- Actions: `login(email, password)` → calls `/api/auth/login`, stores JWT token
- Actions: `logout()` → clears token and state
- Auto-logout on 401 via `app:unauthorized` custom event

**Chat Store** (Zustand, no persistence):
- State: `messages[]`, `loading`, `relevantDocuments[]`, `error`
- Actions: `sendMessage(query)` → POST `/api/chat/generate` → appends response
- Initializes with system greeting message

### 3.4 API Client (`api.ts`)

- **Base URL**: `VITE_API_URL` env variable or `http://localhost:5000/api`
- **Request Interceptor**: Attaches `Authorization: Bearer <token>` from `localStorage`
- **Response Interceptor**: On 401 → dispatches `app:unauthorized` event → triggers auto-logout
- **API Groups**: `authAPI`, `fileAPI`, `documentAPI`, `chatAPI`, `adminAPI`, `healthAPI`

---

## 4. Backend Architecture

### 4.1 Server Structure

```
backend/src/
├── index.ts                       # Express server entry point
│
├── config/
│   └── database.ts                # MongoDB connection config
│
├── routes/
│   ├── auth.ts                    # /api/auth — register, login, verify-worklet, me, profile
│   ├── files.ts                   # /api/files — list, get, stats (user files)
│   ├── documents.ts               # /api/documents — search, stats, by-file
│   ├── chat.ts                    # /api/chat — generate (main RAG endpoint)
│   └── admin.ts                   # /api/admin — system files, users, embeddings (admin only)
│
├── controllers/
│   ├── authController.ts          # Auth logic — signup, login, verify worklet, profile
│   ├── fileController.ts          # File CRUD + triggers document processing
│   ├── documentController.ts      # Document search + stats
│   ├── chatController.ts          # Thin wrapper → calls ragService.generateRAGResponse()
│   └── adminController.ts         # Admin file management, user listing, embedding stats
│
├── middleware/
│   ├── auth.ts                    # JWT verification (protect) + role check (authorize)
│   ├── errorHandler.ts            # Global error handler (CastError, Mongo, JWT, Multer)
│   └── upload.ts                  # Multer config — disk storage, 10MB max, type validation
│
├── models/
│   ├── User.ts                    # User schema (email, password, role, workletId)
│   ├── File.ts                    # File schema (metadata, processing status)
│   ├── Document.ts                # Document chunk schema (content, embedding[], metadata)
│   └── Project.ts                 # Project/Worklet schema (from Excel import)
│
├── services/
│   ├── ragService.ts              # ★ CORE — RAG orchestrator (classification → search → LLM → filter)
│   ├── vectorStore.ts             # Embedding generation + cosine similarity search
│   ├── projectSearchService.ts    # Project DB search + aggregation helpers
│   ├── analyticalQueryService.ts  # Analytical query detection + MongoDB aggregations
│   ├── workletService.ts          # Worklet validation + synthetic content generation
│   ├── documentProcessor.ts       # File → text → chunks → embeddings pipeline
│   └── projectParser.ts           # Excel → Project records parser
│
├── types/
│   └── index.ts                   # Backend TypeScript interfaces
│
└── utils/
    └── jwt.ts                     # JWT sign, verify, decode helpers
```

### 4.2 Middleware Pipeline

```
Incoming Request
    │
    ▼
┌─────────┐
│ Helmet   │  ← Security headers (XSS, CSP, etc.)
└────┬────┘
     ▼
┌─────────┐
│  CORS    │  ← Allow all origins with credentials
└────┬────┘
     ▼
┌──────────────┐
│ JSON Parser   │  ← Body limit: 10MB
└────┬─────────┘
     ▼
┌──────────────┐
│ Static Files  │  ← Serves /uploads directory
└────┬─────────┘
     ▼
┌──────────────┐       ┌─────────────────┐
│   Route      │──────▶│  protect         │  ← JWT verification + user loading
│   Matching   │       │  authorize(role) │  ← Role-based access check
└──────────────┘       └────────┬────────┘
                                ▼
                       ┌────────────────┐
                       │   Controller    │  ← Business logic
                       └────────┬───────┘
                                ▼
                       ┌────────────────┐
                       │ Error Handler   │  ← Catches all errors, returns JSON
                       └────────────────┘
```

---

## 5. Database Schema

### 5.1 Collections Overview

```
MongoDB: samsung-prism
│
├── users           — User accounts (user, admin, student roles)
├── files           — Uploaded file metadata & processing status
├── documents       — Text chunks with vector embeddings (the knowledge base)
└── projects        — Worklet/project records (parsed from Excel uploads)
```

### 5.2 Users Collection

| Field | Type | Description |
|---|---|---|
| `email` | String (unique) | User email, lowercase, regex validated |
| `password` | String | bcrypt hashed (min 6 chars raw) |
| `name` | String | Display name (max 50 chars) |
| `role` | Enum | `user` \| `admin` \| `student` |
| `workletId` | String | Required for students — links to Project |
| `isActive` | Boolean | Account enabled/disabled (default: true) |
| `lastLogin` | Date | Last successful login timestamp |
| `createdAt` | Date | Auto timestamp |
| `updatedAt` | Date | Auto timestamp |

**Indexes**: `email` (unique)  
**Pre-save Hook**: Hashes password with bcrypt (salt rounds = 10)  
**Instance Method**: `comparePassword(candidate)` — bcrypt comparison

### 5.3 Files Collection

| Field | Type | Description |
|---|---|---|
| `userId` | ObjectId (ref User) | Owner — `null` for system/admin files |
| `originalName` | String | Original uploaded filename |
| `filename` | String (unique) | Server-side filename (timestamped) |
| `filePath` | String | Disk path in `uploads/` |
| `fileType` | Enum | `pdf` \| `docx` \| `xlsx` \| `xls` \| `txt` \| `image` \| `unknown` |
| `mimeType` | String | MIME type |
| `size` | Number | File size in bytes |
| `status` | Enum | `uploading` → `processing` → `completed` \| `failed` |
| `processingError` | String | Error message if failed |
| `metadata.category` | String | program-info, credentials, faq, guidelines, synthetic-data, general |
| `metadata.description` | String | Admin-provided description |
| `metadata.isSystemFile` | Boolean | `true` for admin-uploaded system knowledge |

**Indexes**: `{ userId, status }`, `{ uploadedAt: -1 }`

### 5.4 Documents Collection (Vector Knowledge Base)

| Field | Type | Description |
|---|---|---|
| `userId` | ObjectId (ref User) | Owner — `null` for system-wide documents |
| `fileId` | ObjectId (ref File) | Source file reference |
| `content` | String | Text chunk content (max 10,000 chars) |
| `chunkIndex` | Number | Position in source file (0-based) |
| `metadata.source` | String | Source identifier |
| `metadata.page` | Number | Page number (for PDFs) |
| `metadata.section` | String | Section identifier |
| `metadata.tags` | String[] | Categorization tags |
| `metadata.fileName` | String | Human-readable source filename |
| `embedding` | Number[] | **384-dimensional vector** (all-MiniLM-L6-v2) |

**Indexes**: `{ userId, fileId, chunkIndex }` (compound), `{ userId, 'metadata.tags' }`, `content` (text index)

### 5.5 Projects Collection (Worklet Database)

| Field | Type | Description |
|---|---|---|
| `workletId` | String (indexed) | e.g., "001", "055", "112" |
| `workletTitle` | String | Project title |
| `domain` | String | Communication Network, Computer Vision, IoT, Language AI, OnDevice Intelligence |
| `mentors` | String[] | Mentor names |
| `students` | String[] | Student names |
| `college` | String | Institution name |
| `status` | String (indexed) | Good, Average, Poor, Excellent |
| `stage` | String | Mid Review, Final Review |
| `professors` | String[] | Professor names |
| `userEmails` | String[] (indexed) | Extracted emails for access control |
| `userNames` | String[] (indexed) | Extracted names for access control |
| `sourceFile` | ObjectId (ref File) | Excel file this was parsed from |
| `uploadedBy` | ObjectId (ref User) | Admin who uploaded |

**Indexes**: `workletId`, `{ userEmails, status }`, `{ userNames, stage }`, `{ workletId, userEmails }`, text index on `workletTitle + domain + college + mentors + students + professors`

---

## 6. RAG Pipeline — Core Workflow

This is the heart of the system. When a user sends a chat message, here is the complete step-by-step flow:

### 6.1 End-to-End Request Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                     USER SENDS CHAT MESSAGE                       │
│               "What are the requirements for PRISM?"             │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ FRONTEND: ChatInterface.tsx → ragService.ts → api.ts               │
│                                                                    │
│  1. User types message in ChatInput                                │
│  2. handleSendMessage() fires                                      │
│  3. If files attached → uploadFilesForRAG() (POST /api/files)      │
│  4. generateRAGResponse() → chatAPI.generateResponse()             │
│  5. POST /api/chat/generate { query, limit: 5 }                   │
└────────────────────────────┬───────────────────────────────────────┘
                             │  HTTP POST with JWT Bearer token
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ BACKEND: chatController.ts                                         │
│                                                                    │
│  protect middleware → verify JWT → load user from DB               │
│  chatController.generateChatResponse()                             │
│     → ragService.generateRAGResponse(userId, query, limit)         │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ RAG ORCHESTRATOR: ragService.generateRAGResponse()                 │
│                                                                    │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 1: Load User Context                    │                  │
│  │  • Fetch user from MongoDB (role, workletId) │                  │
│  │  • Determine: admin / user / student         │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 2: Analytical Query Check               │                  │
│  │  • "How many worklets have IoT as domain?"   │                  │
│  │  • isAnalyticalQuery() detects count/stats   │                  │
│  │  • If YES → executeAnalyticalQuery()         │                  │
│  │    → MongoDB aggregation → exact numbers     │                  │
│  │    → Return immediately (skip LLM)           │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 3: Greeting / Farewell Detection        │                  │
│  │  • Short query (≤3 words)?                   │                  │
│  │  • Matches "hi/hello/hey/bye/thanks"?        │                  │
│  │  • If YES → return canned response           │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 4: Query Classification                 │                  │
│  │                                              │                  │
│  │  isWorkletQuery?                             │                  │
│  │    → contains "worklet" + numeric ID         │                  │
│  │                                              │                  │
│  │  isPersonalWorkletQuery?                     │                  │
│  │    → "my worklet" / "my project"             │                  │
│  │    → student asking "worklet details" (no ID)│                  │
│  │                                              │                  │
│  │  isGeneralProgramQuery?                      │                  │
│  │    → "eligibility" / "requirements" /        │                  │
│  │      "samsung prism" / "how to apply"        │                  │
│  │    → OR does NOT contain "worklet"           │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 5: Document Search (Vector + Text)      │                  │
│  │                                              │                  │
│  │  vectorStore.searchSimilarDocuments()         │                  │
│  │    1. Generate query embedding (384-dim)      │                  │
│  │    2. Load all docs with embeddings           │                  │
│  │       (system docs + user's docs)            │                  │
│  │    3. Cosine similarity computation           │                  │
│  │    4. Keyword boosting (+15% for matches)    │                  │
│  │    5. Filter by threshold (0.4)              │                  │
│  │    6. Sort by score, return top K            │                  │
│  │                                              │                  │
│  │  For students:                               │                  │
│  │    → Also search synthetic worklet content   │                  │
│  │    → Merge worklet-specific + general docs   │                  │
│  │                                              │                  │
│  │  For general program queries:                │                  │
│  │    → Search only general documents           │                  │
│  │    → Skip worklet-specific content           │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 6: Project Search (if applicable)       │                  │
│  │                                              │                  │
│  │  Conditions to search projects:              │                  │
│  │    • NOT a general program query             │                  │
│  │    • AND (no docs found + project-related    │                  │
│  │      query) OR specific worklet ID query     │                  │
│  │                                              │                  │
│  │  searchExactProject("001")                   │                  │
│  │    → tries: "001", "1", padded variations    │                  │
│  │                                              │                  │
│  │  searchProjects(query)                       │                  │
│  │    → regex across all Project fields         │                  │
│  │    → respects user-based access control      │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 7: Privacy Protection (Students)        │                  │
│  │                                              │                  │
│  │  If student asks about a DIFFERENT worklet:  │                  │
│  │    → Block cross-worklet access              │                  │
│  │    → Return friendly privacy message         │                  │
│  │    → Suggest asking about own worklet        │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 8: Prompt Construction                  │                  │
│  │                                              │                  │
│  │  6 prompt templates based on classification: │                  │
│  │                                              │                  │
│  │  ① General Program Query                     │                  │
│  │     → "Answer using ONLY facts from context" │                  │
│  │                                              │                  │
│  │  ② Personal Worklet Query (student)          │                  │
│  │     → Address student by name, use "your"    │                  │
│  │                                              │                  │
│  │  ③ Specific Worklet ID Query                 │                  │
│  │     → Include all worklet fields             │                  │
│  │                                              │                  │
│  │  ④ Document-Only Response                    │                  │
│  │     → Answer solely from document content    │                  │
│  │                                              │                  │
│  │  ⑤ Mixed/Project-Only Response               │                  │
│  │     → Synthesize from all sources            │                  │
│  │                                              │                  │
│  │  ⑥ No Content Fallback                       │                  │
│  │     → "I don't have specific information..." │                  │
│  │                                              │                  │
│  │  All prompts include:                        │                  │
│  │   • Anti-hallucination instructions          │                  │
│  │   • Conversation history (last 5 turns)      │                  │
│  │   • Student context (if applicable)          │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 9: LLM Generation (Ollama)              │                  │
│  │                                              │                  │
│  │  POST http://localhost:11434/api/generate     │                  │
│  │  Model: phi (2.7B parameters)                │                  │
│  │                                              │                  │
│  │  Parameters (with context):                  │                  │
│  │    temperature: 0.3 (low — factual)          │                  │
│  │    top_p: 0.8                                │                  │
│  │    repeat_penalty: 1.3                       │                  │
│  │    num_ctx: 2048 (token window)              │                  │
│  │    num_predict: 200 (max output tokens)      │                  │
│  │                                              │                  │
│  │  Parameters (no context — fallback):         │                  │
│  │    temperature: 0.05 (near-deterministic)    │                  │
│  │    num_ctx: 512                              │                  │
│  │    num_predict: 50                           │                  │
│  │    stop: [scenario, hypothetical, ...]       │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 10: Hallucination Filtering (3 layers)  │                  │
│  │                                              │                  │
│  │  Layer 1 — No-content hallucination check:   │                  │
│  │    • Pattern matching (scenarios, rules...)  │                  │
│  │    • Length check (>150 chars = suspicious)   │                  │
│  │    → Fallback: generic "I don't have info"   │                  │
│  │                                              │                  │
│  │  Layer 2 — Global hallucination patterns:    │                  │
│  │    • Fake User:/Assistant: conversations     │                  │
│  │    • Invented numbered mentor lists          │                  │
│  │    • "System has been programmed" phrases    │                  │
│  │    → Fallback: extract first clean sentence  │                  │
│  │                                              │                  │
│  │  Layer 3 — Context grounding check:          │                  │
│  │    • Word overlap between response & context │                  │
│  │    • If <5% overlap → model ignored docs     │                  │
│  │    → Retry with stricter, shorter prompt     │                  │
│  └──────────────────┬──────────────────────────┘                   │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                   │
│  │ STEP 11: Memory & Response Assembly          │                  │
│  │                                              │                  │
│  │  • Store Q&A in conversation memory          │                  │
│  │    (last 5 turns, 30-min expiry)            │                  │
│  │  • Combine document sources + project sources│                  │
│  │  • Return { answer, sources[], query }       │                  │
│  └─────────────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ FRONTEND: ChatInterface receives response                          │
│  • Display AI message in ChatHistory                               │
│  • Show source documents in DocumentViewer sidebar                 │
│  • Sources clickable — show file name, content snippet, relevance  │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 Query Classification Decision Tree

```
                     User Query
                         │
                ┌────────┴────────┐
                │ Contains numbers │
                │  like count/how  │
                │  many/total?     │
                └───┬──────┬──────┘
                YES │      │ NO
                    ▼      ▼
            ┌───────────┐  │
            │ Analytical │  │
            │ Engine     │  │
            │ (DB query) │  │
            └───────────┘  │
                           │
                ┌──────────┴──────────┐
                │ Short (≤3 words) +   │
                │ greeting/farewell?   │
                └───┬──────┬──────────┘
                YES │      │ NO
                    ▼      ▼
            ┌───────────┐  │
            │ Canned     │  │
            │ Response   │  │
            └───────────┘  │
                           │
              ┌────────────┴────────────────┐
              │ Contains "worklet" + number? │
              └──┬──────────────────────┬───┘
              YES│                      │ NO
                 ▼                      │
         ┌──────────────┐               │
         │ isWorkletQuery│               │
         │ = true        │               │
         └──────────────┘               │
                                        │
              ┌─────────────────────────┴───────────────┐
              │ Contains "my worklet" / "my project"?   │
              │ OR student asking "worklet details"?    │
              └──┬───────────────────────────────┬──────┘
              YES│                               │ NO
                 ▼                               │
        ┌────────────────┐                       │
        │ isPersonal      │                      │
        │ WorkletQuery    │                      │
        │ = true          │                      │
        └────────────────┘                       │
                                                 │
              ┌──────────────────────────────────┴──────┐
              │ Contains "eligibility" / "requirements" │
              │ / "samsung prism" / "how to apply"?     │
              │ OR does NOT contain "worklet"?           │
              └──┬────────────────────────────────┬─────┘
              YES│                                │ NO
                 ▼                                ▼
        ┌────────────────┐              ┌────────────────┐
        │ isGeneralProgram│              │ Default:       │
        │ Query = true    │              │ Mixed query    │
        └────────────────┘              └────────────────┘
```

### 6.3 Vector Search Details

```
Query: "What are the requirements for PRISM?"
                │
                ▼
┌──────────────────────────────────────┐
│ 1. Generate Query Embedding           │
│    Model: Xenova/all-MiniLM-L6-v2    │
│    Output: Float32Array[384]          │
│    Pooling: Mean + L2 normalization   │
└───────────────┬──────────────────────┘
                ▼
┌──────────────────────────────────────┐
│ 2. Load Candidate Documents           │
│    • System docs (userId: null)       │
│    • User's own docs (userId match)   │
│    • Filter: must have embedding[]    │
└───────────────┬──────────────────────┘
                ▼
┌──────────────────────────────────────┐
│ 3. Cosine Similarity Computation      │
│                                       │
│    sim(q, d) = Σ(q_i × d_i)          │
│                ─────────────          │
│               ||q|| × ||d||          │
│                                       │
│    For each document chunk:           │
│      score = cosineSim(queryEmb, docEmb)│
└───────────────┬──────────────────────┘
                ▼
┌──────────────────────────────────────┐
│ 4. Keyword Boosting                   │
│    • Extract query keywords (>2 chars)│
│    • If doc.content contains keyword: │
│      score += 0.15 × (matches/total) │
│    • Max boost: 15%                   │
└───────────────┬──────────────────────┘
                ▼
┌──────────────────────────────────────┐
│ 5. Filter & Sort                      │
│    • Threshold: score ≥ 0.4           │
│    • Sort descending by score         │
│    • Return top K results             │
└──────────────────────────────────────┘
```

---

## 7. Document Processing Pipeline

When an admin uploads a file (PDF, DOCX, XLSX, TXT, or image), here's the complete processing flow:

```
┌───────────────────────────────────────────────────────────────────┐
│                    ADMIN UPLOADS FILE                              │
│  AdminDashboard → POST /api/admin/files/upload (multipart/form)  │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ adminController.uploadSystemFile()                                 │
│                                                                    │
│  1. Multer saves file to backend/uploads/ (timestamped filename)  │
│  2. Create File record in MongoDB:                                 │
│     • userId: null (system file)                                   │
│     • status: "uploading"                                          │
│     • metadata: { category, description, isSystemFile: true }     │
│  3. If XLSX/XLS → also trigger projectParser.processProjectFile() │
│  4. Trigger processAndSaveFile(fileId) in background              │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ documentProcessor.processAndSaveFile(fileId)                       │
│                                                                    │
│  1. Load File record, set status → "processing"                   │
│                                                                    │
│  2. TEXT EXTRACTION (based on fileType):                           │
│     ┌──────────┬──────────────────────────────────┐               │
│     │ PDF      │ pdf-parse → extracts all pages    │               │
│     │ DOCX     │ mammoth → converts to plain text  │               │
│     │ XLSX/XLS │ ExcelJS → reads all sheets/cells  │               │
│     │ TXT      │ fs.readFile → raw text            │               │
│     │ Image    │ tesseract.js → OCR text extract   │               │
│     └──────────┴──────────────────────────────────┘               │
│                                                                    │
│  3. TEXT CHUNKING:                                                 │
│     chunkText(extractedText, chunkSize=800, overlap=100)          │
│     • Split on sentence boundaries (. ! ? \n)                     │
│     • Each chunk: ~800 chars with 100-char overlap                │
│     • Overlap preserves context between adjacent chunks           │
│                                                                    │
│  4. SAVE DOCUMENT CHUNKS:                                          │
│     For each chunk:                                                │
│       → Create Document record (content, chunkIndex, metadata)    │
│                                                                    │
│  5. GENERATE EMBEDDINGS:                                           │
│     For each Document chunk:                                       │
│       → vectorStore.generateEmbedding(chunk.content)              │
│       → Model: all-MiniLM-L6-v2 (384-dim output)                 │
│       → Mean pooling + L2 normalization                           │
│       → Store embedding[] on Document record                      │
│                                                                    │
│  6. Update File status → "completed"                               │
│     (or "failed" with error message if anything breaks)           │
└────────────────────────────────────────────────────────────────────┘
```

### Excel → Project Import (Additional Pipeline)

```
Admin uploads .xlsx file
        │
        ▼
projectParser.processProjectFile(file, uploadedBy)
        │
        ▼
parseProjectsFromExcel(filePath)
  • Read workbook with ExcelJS
  • Auto-detect columns by header matching:
    "worklet id", "worklet title", "domain", "mentor",
    "student", "college", "status", "stage", "professor"
  • Handle multiple mentor/student/professor columns
  • Clean non-ASCII from worklet IDs
  • Return ProjectData[]
        │
        ▼
saveProjectsToDatabase(projects, sourceFileId, uploadedBy)
  • Delete old projects from same source file
  • For each project:
    → Extract emails from people fields (regex)
    → Extract names and normalize
    → Build userEmails[] and userNames[] arrays
  • Project.insertMany(enrichedProjects)
```

---

## 8. Analytical Query Engine

Handles counting, aggregation, and statistical queries directly against MongoDB — no LLM needed.

### 8.1 Detection

```
User: "How many worklets have IoT as domain?"
            │
            ▼
isAnalyticalQuery(query) checks for patterns:
  • "how many"
  • "count of"
  • "total number"
  • "distribution"
  • "breakdown"
  • "statistics"
  • "percentage"
  • "list all unique"
```

### 8.2 Intent Parsing (5-layer pattern matching)

```
"How many worklets have IoT as domain?"
            │
            ▼
parseAnalyticalIntent(query)
            │
  ┌─────────┴─────────────────────────────┐
  │ Pattern A: "VALUE as FIELD"            │
  │   "have IoT as domain"                 │
  │   → field: "domain", value: "iot"      │ ✓ MATCH
  └────────────────────────────────────────┘
  
  Pattern B: "FIELD as/is VALUE"
    e.g., "status as average" → field: status, value: average

  Pattern C: "in/from/at VALUE FIELD"
    e.g., "in IoT domain" → field: domain, value: iot

  Pattern C2: "in/from/at VALUE" (no field keyword)
    e.g., "from Thapar" → auto-detect field

  Pattern D: Known value matching
    e.g., "good" → matches KNOWN_STATUSES → field: status

  Pattern E: Last resort — extract non-stop words
    → field: auto (search all fields)
```

### 8.3 Execution

```
Intent: { type: "count_filtered", field: "domain", value: "iot" }
            │
            ▼
executeAnalyticalQuery()
            │
            ▼
MongoDB: Project.countDocuments({ domain: /iot/i })
            │
            ▼
Result: { count: 98, total: 500 }
            │
            ▼
Format: "There are 98 worklets with domain matching 'iot'
         (out of 500 total worklets — 19.6%).
         
         Sample worklet IDs: 003, 017, 024, 031, 045"
```

### 8.4 Query Types Supported

| Query Type | Example | MongoDB Operation |
|---|---|---|
| `total_count` | "How many worklets are there?" | `countDocuments({})` |
| `count_filtered` | "How many have IoT domain?" | `countDocuments({ domain: /iot/i })` |
| `distribution` | "What is the status distribution?" | `$group` aggregation |
| `list_unique` | "List all unique domains" | `distinct('domain')` |
| Auto-detect | "How many IoT worklets?" | Search all 7 fields, pick best match |

---

## 9. Authentication & Authorization Flow

### 9.1 Signup Flow

```
┌─────────────┐     POST /api/auth/signup     ┌──────────────────┐
│  SignupPage  │ ───────────────────────────▶  │ authController    │
│              │  { email, password, name,     │  .signup()        │
│              │    role, workletId? }         │                   │
└─────────────┘                                │  1. Validate role │
                                               │  2. If student:   │
                                               │     → validate    │
                                               │       workletId   │
                                               │     → check unique│
                                               │  3. Hash password │
                                               │  4. Create User   │
                                               │  5. Return JWT    │
                                               └──────────────────┘
```

### 9.2 Login Flow

```
┌─────────────┐    POST /api/auth/login      ┌──────────────────┐
│  LoginForm   │ ──────────────────────────▶  │ authController    │
│              │  { email, password }         │  .login()         │
└──────┬──────┘                               │                   │
       │                                      │  1. Find user     │
       │                                      │  2. Check isActive│
       │                                      │  3. bcrypt compare│
       │                                      │  4. Update lastLogin│
       │                                      │  5. Sign JWT:     │
       │         { token, user }              │    { id, email,   │
       │◀─────────────────────────────────────│      role }       │
       │                                      │    expires: 7d    │
       ▼                                      └──────────────────┘
  Zustand authStore:
    • Stores token in localStorage
    • Sets user state
    • Sets isAuthenticated = true
```

### 9.3 Request Authentication

```
Protected API Request
        │
        │  Authorization: Bearer <jwt_token>
        ▼
┌────────────────────┐
│  protect middleware  │
│                     │
│  1. Extract token   │
│  2. jwt.verify()    │
│  3. Load user by ID │
│  4. Check isActive  │
│  5. Attach user to  │
│     req.user        │
└────────┬───────────┘
         │
         ▼ (if role check needed)
┌────────────────────────┐
│ authorize('admin')      │
│                         │
│ Check req.user.role     │
│ against allowed roles   │
│ → 403 if unauthorized   │
└────────────────────────┘
```

### 9.4 Role-Based Access Control

| Role | Chat Access | Own Files | System Files | Admin Panel | All Users | Cross-Worklet |
|---|---|---|---|---|---|---|
| `user` | ✅ | ✅ | Read | ❌ | ❌ | N/A |
| `student` | ✅ (own worklet context) | ✅ | Read | ❌ | ❌ | ❌ Blocked |
| `admin` | ✅ (all data) | ✅ | Full CRUD | ✅ | ✅ | ✅ Full access |

---

## 10. API Endpoints Reference

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Register new user |
| POST | `/signup` | Public | Signup with role + worklet validation |
| POST | `/login` | Public | Login → returns JWT |
| POST | `/verify-worklet` | Public | Validate worklet ID exists |
| GET | `/me` | Protected | Get current user profile |
| PUT | `/profile` | Protected | Update profile |

### Files (`/api/files`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Protected | List user's files |
| GET | `/stats` | Protected | File statistics |
| GET | `/:id` | Protected | Get single file |

### Documents (`/api/documents`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/search` | Protected | Search documents (vector + text) |
| GET | `/stats` | Protected | Document statistics |
| GET | `/:fileId` | Protected | Documents for a specific file |
| DELETE | `/:fileId` | Protected | Delete documents for file |

### Chat (`/api/chat`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/generate` | Protected | **Main RAG endpoint** — query → answer + sources |

### Admin (`/api/admin`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/files/upload` | Admin | Upload system knowledge file |
| GET | `/files` | Admin | List all system files |
| GET | `/files/stats` | Admin | System file statistics |
| DELETE | `/files/:id` | Admin | Delete system file + embeddings |
| GET | `/users` | Admin | List all users |
| GET | `/users/:id` | Admin | User details |
| GET | `/embeddings/stats` | Admin | Embedding coverage statistics |

### Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Server health check |

---

## 11. File & Directory Structure

```
project 005/
│
├── 📄 index.html                     # SPA entry HTML
├── 📄 package.json                   # Frontend dependencies
├── 📄 vite.config.ts                 # Vite build configuration
├── 📄 tailwind.config.js             # Tailwind CSS + Samsung brand
├── 📄 postcss.config.js              # PostCSS config
├── 📄 tsconfig.json                  # Root TypeScript config
├── 📄 tsconfig.app.json              # App-specific TS config
├── 📄 tsconfig.node.json             # Node-specific TS config
├── 📄 eslint.config.js               # ESLint configuration
├── 📄 vercel.json                    # Vercel deployment config
│
├── 📂 public/                        # Static assets
│
├── 📂 src/                           # ─── FRONTEND SOURCE ───
│   ├── App.tsx                       #   Root + routing
│   ├── main.tsx                      #   Entry point
│   ├── index.css                     #   Global styles
│   ├── 📂 components/                #   UI Components
│   ├── 📂 pages/                     #   Page-level components
│   ├── 📂 services/                  #   API + RAG services
│   ├── 📂 store/                     #   Zustand stores
│   ├── 📂 contexts/                  #   React contexts (theme)
│   ├── 📂 types/                     #   TypeScript definitions
│   └── 📂 utils/                     #   Utility functions
│
└── 📂 backend/                       # ─── BACKEND SOURCE ───
    ├── 📄 package.json               #   Backend dependencies
    ├── 📄 tsconfig.json              #   Backend TS config
    ├── 📄 env.example                #   Environment variables template
    │
    ├── 📂 src/
    │   ├── index.ts                  #   Express server entry
    │   ├── 📂 config/                #   Database config
    │   ├── 📂 routes/                #   API route definitions
    │   ├── 📂 controllers/           #   Request handlers
    │   ├── 📂 middleware/            #   Auth, errors, upload
    │   ├── 📂 models/                #   Mongoose schemas
    │   ├── 📂 services/              #   ★ Core business logic
    │   │   ├── ragService.ts         #     RAG orchestrator
    │   │   ├── vectorStore.ts        #     Embedding + search
    │   │   ├── analyticalQueryService.ts  # DB aggregations
    │   │   ├── projectSearchService.ts    # Project search
    │   │   ├── workletService.ts     #     Worklet service
    │   │   ├── documentProcessor.ts  #     File → chunks → embeddings
    │   │   └── projectParser.ts      #     Excel → Project records
    │   ├── 📂 types/                 #   Backend types
    │   └── 📂 utils/                 #   JWT utilities
    │
    ├── 📂 uploads/                   #   Stored uploaded files
    └── 📂 models-cache/              #   Cached ML models
        └── 📂 Xenova/
            └── all-MiniLM-L6-v2/     #   Sentence transformer model
```

---

## 12. Deployment Architecture

### Development

```
┌─────────────────────────┐    ┌─────────────────────────┐
│ Vite Dev Server          │    │ Express Backend          │
│ http://localhost:5173    │───▶│ http://localhost:5000    │
│ (Hot Module Replacement) │    │ (nodemon + ts-node)      │
└─────────────────────────┘    └──────────┬──────────────┘
                                          │
                               ┌──────────┴──────────────┐
                               │                          │
                        ┌──────┴──────┐          ┌───────┴───────┐
                        │  MongoDB     │          │  Ollama       │
                        │  :27017      │          │  :11434       │
                        │samsung-prism │          │  phi model    │
                        └─────────────┘          └───────────────┘
```

### Production (Vercel + Self-hosted Backend)

```
┌──────────────────┐       ┌────────────────────────┐
│ Vercel CDN        │       │ Backend Server          │
│ (Static SPA)      │──────▶│ (Express + MongoDB +    │
│ React + Vite      │ HTTPS │  Ollama + Embeddings)   │
│ dist/ output      │       │                         │
└──────────────────┘       └────────────────────────┘
```

### Environment Variables

```env
# Backend (.env)
PORT=5000
MONGODB_URI=mongodb://localhost:27017/samsung-prism
JWT_SECRET=<secret_key>
JWT_EXPIRES_IN=7d
MAX_FILE_SIZE=10485760    # 10MB
OLLAMA_URL=http://localhost:11434

# Frontend (.env)
VITE_API_URL=http://localhost:5000/api
```

---

## Conversation Memory System

```
In-Memory Map: userId → ConversationTurn[]

┌─────────────────────────────────────────────┐
│ ConversationTurn {                           │
│   query: string      — user's question       │
│   answer: string     — AI's response         │
│   timestamp: Date    — when it happened       │
│ }                                            │
│                                              │
│ Config:                                      │
│   MAX_MEMORY_TURNS = 5  (last 5 exchanges)  │
│   MEMORY_EXPIRY = 30 min                     │
│   Cleanup interval: every 5 min              │
│                                              │
│ Purpose:                                     │
│   • Context continuity across turns          │
│   • Injected into LLM prompt as history      │
│   • Enables follow-up questions              │
└─────────────────────────────────────────────┘
```

---

*Generated for Samsung PRISM RAG Chatbot Project — February 2026*

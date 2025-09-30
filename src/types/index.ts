// Message types for chat
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  attachments?: FileAttachment[];
}

// File attachment interface
export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  url?: string;
}

// Document for RAG knowledge base
export interface Document {
  id: string;
  title: string;
  content: string;
  metadata: {
    source: string;
    date_added: Date;
    tags: string[];
    page?: number;
    fileName?: string;
  };
}

// Chat history interface
export interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// User for authentication
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'student';
  avatar?: string;
  prismUID?: string;
  workletId?: string;
}

// Search result with relevance
export interface SearchResult {
  document: Document;
  relevanceScore: number;
}

// Uploaded file processing result
export interface ProcessedFile {
  id: string;
  name: string;
  type: string;
  extractedText: string;
  chunks: Document[];
  processingStatus: 'processing' | 'completed' | 'error';
}

// PRISM Authentication types
export interface PrismAuthCredentials {
  username: string;
  password: string;
}

export interface PrismAuthResponse {
  success: boolean;
  sessionToken?: string;
  cookies?: string[];
  userInfo?: {
    uid: string;
    name: string;
    email: string;
  };
  error?: string;
}

export interface PrismSession {
  token: string;
  cookies: string[];
  uid: string;
  expiresAt: Date;
  userInfo: {
    name: string;
    email: string;
  };
}

// PRISM Worklet types
export interface WorkletStatus {
  id: string;
  name: string;
  description: string;
}

export interface WorkletDetail {
  workletId: string;
  title: string;
  description: string;
  status: string;
  statusName: string;
  assignedDate: string;
  dueDate: string;
  progress: number;
  mentorName: string;
  mentorEmail: string;
  teamMembers: string[];
  technologies: string[];
  domain: string;
  lastUpdated: string;
  comments?: string;
  deliverables?: string[];
  milestones?: WorkletMilestone[];
}

export interface WorkletMilestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  completedDate?: string;
}

export interface PrismApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'student';
  workletId?: string;
}

export interface WorkletValidationResponse {
  valid: boolean;
  workletDetails?: {
    id: string;
    title: string;
    description?: string;
    mentor?: string;
  };
  error?: string;
}
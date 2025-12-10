import axios from 'axios';

// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        // Emit a custom event so the app can handle logout without full reload
        window.dispatchEvent(new CustomEvent('app:unauthorized'));
      } catch (_) {
        // no-op
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  
  signup: (data: { name: string; email: string; password: string; role: string; workletId?: string }) =>
    api.post('/auth/signup', data),
  
  verifyWorklet: (data: { workletId: string }) =>
    api.post('/auth/verify-worklet', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  getMe: () => api.get('/auth/me'),
  
  updateProfile: (data: { name?: string; email?: string }) =>
    api.put('/auth/profile', data),
};

// File API
export const fileAPI = {
  getUserFiles: (params?: { status?: string; fileType?: string; page?: number; limit?: number }) =>
    api.get('/files', { params }),
  
  getFile: (id: string) => api.get(`/files/${id}`),
  
  getFileStats: () => api.get('/files/stats'),
  
  uploadFile: (formData: FormData) =>
    api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
    
  deleteFile: (id: string) => api.delete(`/files/${id}`),
};

// Document API
export const documentAPI = {
  searchDocuments: (query: string, limit: number = 5) =>
    api.get('/documents/search', { params: { q: query, limit } }),
  
  getDocumentsForFile: (fileId: string) =>
    api.get(`/documents/${fileId}`),
  
  getDocumentStats: () => api.get('/documents/stats'),
};

// Chat API
export const chatAPI = {
  generateResponse: (data: { query: string; limit?: number }) =>
    api.post('/chat/generate', data),
};

// Admin API
export const adminAPI = {
  uploadSystemFile: (formData: FormData) =>
    api.post('/admin/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  
  getSystemFiles: (params?: { category?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/admin/files', { params }),
  
  getSystemFileStats: () => api.get('/admin/files/stats'),
  
  deleteSystemFile: (id: string) => api.delete(`/admin/files/${id}`),
  
  getAllUsers: (params?: { role?: string; page?: number; limit?: number }) =>
    api.get('/admin/users', { params }),
  
  getUserDetails: (id: string) => api.get(`/admin/users/${id}`),
};

// Health check
export const healthAPI = {
  check: () => axios.get(`${API_BASE_URL.replace('/api', '')}/api/health`),
};

export default api;

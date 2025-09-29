import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import './AdminDashboard.css';

interface SystemFile {
  id: string;
  originalName: string;
  filename: string;
  fileType: string;
  category?: string;
  description?: string;
  size: number;
  status: string;
  uploadedAt: string;
  processedAt?: string;
}

interface SystemFileStats {
  totalFiles: number;
  totalSize: number;
  categoryCounts: Record<string, number>;
  statusCounts: Record<string, number>;
}

const AdminDashboard: React.FC = () => {
  const [files, setFiles] = useState<SystemFile[]>([]);
  const [stats, setStats] = useState<SystemFileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    category: 'program-info',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [filesResponse, statsResponse] = await Promise.all([
        adminAPI.getSystemFiles(),
        adminAPI.getSystemFileStats()
      ]);
      
      setFiles(filesResponse.data.data.files);
      setStats(statsResponse.data.data);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadForm.category);
      formData.append('description', uploadForm.description);

      await adminAPI.uploadSystemFile(formData);
      
      // Reset form and reload data
      setUploadForm({ category: 'program-info', description: '' });
      event.target.value = '';
      await loadData();
      
      alert('File uploaded successfully!');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await adminAPI.deleteSystemFile(fileId);
      await loadData();
      alert('File deleted successfully!');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return <div className="admin-dashboard loading">Loading admin dashboard...</div>;
  }

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="stats-section">
          <h2>System Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Files</h3>
              <p>{stats.totalFiles}</p>
            </div>
            <div className="stat-card">
              <h3>Total Size</h3>
              <p>{formatFileSize(stats.totalSize)}</p>
            </div>
            <div className="stat-card">
              <h3>Categories</h3>
              <p>{Object.keys(stats.categoryCounts).length}</p>
            </div>
          </div>
        </div>
      )}

      {/* File Upload */}
      <div className="upload-section">
        <h2>Upload System File</h2>
        <div className="upload-form">
          <div className="form-group">
            <label>Category:</label>
            <select
              value={uploadForm.category}
              onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
            >
              <option value="program-info">Program Information</option>
              <option value="credentials">Credentials</option>
              <option value="faq">Frequently Asked Questions</option>
              <option value="guidelines">Guidelines</option>
              <option value="synthetic-data">Synthetic Data</option>
              <option value="general">General</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Description:</label>
            <input
              type="text"
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="Brief description of the file content"
            />
          </div>
          
          <div className="form-group">
            <label>File:</label>
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.txt,.jpg,.jpeg,.png,.gif"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <small className="file-help">
              Supported formats: PDF, DOCX, XLSX, TXT, Images (JPG, PNG, GIF)
            </small>
          </div>
          
          {uploading && <p>Uploading file...</p>}
        </div>
      </div>

      {/* File List */}
      <div className="files-section">
        <h2>System Files</h2>
        {files.length === 0 ? (
          <p>No system files uploaded yet.</p>
        ) : (
          <div className="files-grid">
            {files.map((file) => (
              <div key={file.id} className="file-card">
                <div className="file-header">
                  <h3>{file.originalName}</h3>
                  <span className={`status ${file.status}`}>{file.status}</span>
                </div>
                
                <div className="file-details">
                  <p><strong>Type:</strong> {file.fileType.toUpperCase()}</p>
                  <p><strong>Size:</strong> {formatFileSize(file.size)}</p>
                  <p><strong>Category:</strong> {file.category || 'General'}</p>
                  {file.description && (
                    <p><strong>Description:</strong> {file.description}</p>
                  )}
                  <p><strong>Uploaded:</strong> {new Date(file.uploadedAt).toLocaleDateString()}</p>
                </div>
                
                <div className="file-actions">
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="delete-btn"
                    title={file.status === 'processing' ? 'File is currently being processed. Delete anyway?' : 'Delete file'}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

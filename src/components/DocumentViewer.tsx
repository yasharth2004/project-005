import React from 'react';
import { Document } from '../types';
import './DocumentViewer.css';

interface DocumentViewerProps {
  documents: Document[];
  onSelectDocument?: (document: Document) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  documents, 
  onSelectDocument 
}) => {
  if (documents.length === 0) {
    return (
      <div className="document-viewer empty">
        <p>No relevant documents found</p>
      </div>
    );
  }

  return (
    <div className="document-viewer">
      <h3 className="document-viewer-title">Related Documents</h3>
      <div className="document-list">
        {documents.map((doc) => (
          <div 
            key={doc.id} 
            className="document-card"
            onClick={() => onSelectDocument && onSelectDocument(doc)}
          >
            <h4 className="document-title">{doc.title}</h4>
            <p className="document-excerpt">
              {doc.content.length > 100 
                ? `${doc.content.substring(0, 100)}...` 
                : doc.content}
            </p>
            <div className="document-meta">
              <span className="document-source">{doc.metadata.fileName || doc.metadata.source}</span>
            </div>
            {doc.metadata.tags && doc.metadata.tags.length > 0 && (
              <div className="document-tags">
                {doc.metadata.tags.map((tag, index) => (
                  <span 
                    key={index} 
                    className={`document-tag ${tag === 'rag-source' ? 'rag-source' : ''}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentViewer;
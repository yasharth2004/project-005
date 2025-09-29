import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, FileText, Image, File, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { FileAttachment, ProcessedFile } from '../types';
import { createFileAttachment, processFile, isSupportedFileType, getFileTypeDisplayName } from '../utils/fileProcessor';
import { fileAPI } from '../services/api';
import './ChatInput.css';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: FileAttachment[], processedFiles?: ProcessedFile[]) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false }) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize the textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      if (!isSupportedFileType(file)) {
        alert(`Unsupported file type: ${getFileTypeDisplayName(file.type)}. Please upload images, PDFs, Word documents, or text files.`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert(`File ${file.name} is too large. Please upload files smaller than 10MB.`);
        continue;
      }

      const attachment = createFileAttachment(file);
      setAttachments(prev => [...prev, attachment]);
      
      // Start processing the file
      setProcessingFiles(prev => new Set([...prev, attachment.id]));
      
      try {
        console.log('Starting to process file:', file.name);
        const processed = await processFile(file);
        console.log('File processed:', processed);
        
        setProcessedFiles(prev => [...prev, processed]);
        
        if (processed.processingStatus === 'completed') {
          console.log('File processing completed successfully:', file.name);
          console.log('Extracted text preview:', processed.extractedText.substring(0, 200) + '...');
        } else {
          console.error('File processing failed:', file.name);
        }
      } catch (error) {
        console.error('Error processing file:', error);
        // Update the processed file with error status
        setProcessedFiles(prev => [...prev, {
          id: attachment.id,
          name: file.name,
          type: file.type,
          extractedText: '',
          chunks: [],
          processingStatus: 'error'
        }]);
      } finally {
        setProcessingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(attachment.id);
          return newSet;
        });
      }
    }
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
    setProcessedFiles(prev => prev.filter(pf => pf.id !== attachmentId));
    setProcessingFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(attachmentId);
      return newSet;
    });
  };

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if ((trimmedMessage || attachments.length > 0) && !disabled && processingFiles.size === 0) {
      console.log('Sending message with attachments:', attachments.length, 'processed files:', processedFiles.length);
      onSendMessage(trimmedMessage, attachments, processedFiles);
      setMessage('');
      setAttachments([]);
      setProcessedFiles([]);
      setProcessingFiles(new Set());
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image size={16} />;
    if (fileType === 'application/pdf') return <FileText size={16} />;
    if (fileType.includes('word')) return <FileText size={16} />;
    return <File size={16} />;
  };

  const getFileStatus = (attachmentId: string) => {
    if (processingFiles.has(attachmentId)) return 'processing';
    const processed = processedFiles.find(pf => pf.id === attachmentId);
    if (processed?.processingStatus === 'error') return 'error';
    if (processed?.processingStatus === 'completed') return 'completed';
    return 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Clock size={14} className="animate-spin" />;
      case 'completed':
        return <CheckCircle size={14} />;
      case 'error':
        return <AlertCircle size={14} />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Ready';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  };

  // Reset textarea height when message is cleared
  useEffect(() => {
    if (message === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message]);

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        {attachments.length > 0 && (
          <div className="file-preview">
            {attachments.map((attachment) => {
              const status = getFileStatus(attachment.id);
              return (
                <div 
                  key={attachment.id} 
                  className={`file-preview-item ${status}`}
                >
                  {getFileIcon(attachment.type)}
                  <span>{attachment.name}</span>
                  {getStatusIcon(status)}
                  <span className="status-text">{getStatusText(status)}</span>
                  <button
                    className="file-remove-button"
                    onClick={() => removeAttachment(attachment.id)}
                    type="button"
                    disabled={status === 'processing'}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="chat-input-main">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Type your message here..."
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
          />
          
          <div className="input-actions">
            <button 
              className="file-upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              type="button"
              aria-label="Upload file"
              title="Upload images, PDFs, Word docs, or text files"
            >
              <Paperclip size={20} />
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              className="file-input"
              onChange={handleFileSelect}
              multiple
              accept="image/*,.pdf,.docx,.txt"
            />
            
            <button 
              className="send-button"
              onClick={handleSendMessage}
              type="button"
              disabled={(!message.trim() && attachments.length === 0) || disabled || processingFiles.size > 0}
              aria-label="Send message"
              title={processingFiles.size > 0 ? "Please wait for files to finish processing" : "Send message"}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="input-info">
        Press Enter to send, Shift+Enter for new line • Supports images, PDFs, Word docs, text files
      </div>
    </div>
  );
};

export default ChatInput;
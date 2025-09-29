import React, { useState, useEffect } from 'react';
import ChatHistory from './ChatHistory';
import ChatInput from './ChatInput';
import DocumentViewer from './DocumentViewer';
import { Message, FileAttachment, ProcessedFile } from '../types';
import { createUserMessage, createAssistantMessage, createSystemMessage } from '../utils/chatUtils';
import { uploadFilesForRAG, generateRAGResponse, waitForFileProcessing, UploadedFileResult } from '../services/ragService';
import './ChatInterface.css';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [relevantDocuments, setRelevantDocuments] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileResult[]>([]);

  // Initialize with a system message
  useEffect(() => {
    const initialMessage = createSystemMessage(
      "Hello! I'm the Samsung PRISM AI Assistant. I can help you with information about the PRISM program, mentorship, project submissions, and technical questions. You can also upload documents (images, PDFs, Word docs, text files) for me to analyze!"
    );
    setMessages([initialMessage]);
  }, []);

  const handleSendMessage = async (content: string, attachments?: FileAttachment[], processedFiles?: ProcessedFile[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;
    
    console.log('🚀 === MESSAGE HANDLING STARTED ===');
    console.log('💬 Content:', content);
    console.log('📎 Attachments:', attachments?.length || 0);
    console.log('📄 Processed files:', processedFiles?.length || 0);
    
    let newUploadedFiles: UploadedFileResult[] = [];
    
    // Upload files to backend if any
    if (attachments && attachments.length > 0) {
      console.log('📚 === UPLOADING FILES TO BACKEND ===');
      
      try {
        // Convert FileAttachment back to File objects for upload
        const filesToUpload: File[] = [];
        
        // We need to get the original File objects from the FileAttachment URLs
        // For now, we'll skip the actual file upload and use the processed files content
        
        if (processedFiles && processedFiles.length > 0) {
          console.log('📄 Using processed file content for RAG query');
          // Store the processed files as if they were uploaded
          newUploadedFiles = processedFiles.map(pf => ({
            fileId: pf.id,
            fileName: pf.name,
            status: pf.processingStatus === 'completed' ? 'completed' as const : 'failed' as const
          }));
        }
      } catch (error) {
        console.error('❌ Error uploading files:', error);
      }
    }
    
    // Create appropriate message content
    let messageContent = content;
    if (!content.trim() && attachments && attachments.length > 0) {
      const fileNames = attachments.map(att => att.name).join(', ');
      messageContent = `I've uploaded ${attachments.length} file(s): ${fileNames}. Please analyze the content and tell me what's in these files.`;
    }
    
    // Add user message to chat
    const userMessage = createUserMessage(messageContent, attachments);
    setMessages(prev => [...prev, userMessage]);
    
    // Update uploaded files state
    if (newUploadedFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
    }
    
    // Show loading state
    setLoading(true);
    
    try {
      // Create search query - prioritize uploaded file content
      let searchQuery = content.trim();
      
      if (processedFiles && processedFiles.length > 0) {
        const successfulFiles = processedFiles.filter(f => f.processingStatus === 'completed');
        if (successfulFiles.length > 0) {
          // If user didn't provide specific query, use the file content for search
          if (!searchQuery) {
            searchQuery = `analyze content: ${successfulFiles.map(f => f.extractedText.substring(0, 500)).join(' ')}`;
          } else {
            // Combine user query with file content for better search
            searchQuery = `${searchQuery} Content from uploaded files: ${successfulFiles.map(f => f.extractedText.substring(0, 300)).join(' ')}`;
          }
        }
      }
      
      if (!searchQuery) {
        searchQuery = "general assistance";
      }
      
      console.log('🔍 === BACKEND RAG REQUEST ===');
      console.log('🔍 Search query length:', searchQuery.length);
      console.log('🔍 Search query preview:', searchQuery.substring(0, 200) + '...');
      
      // Generate RAG response
      const ragResponse = await generateRAGResponse(searchQuery, newUploadedFiles);
      
      console.log('✅ RAG response:', {
        answerLength: ragResponse.answer.length,
        sourcesCount: ragResponse.sources.length
      });
      
      // Set relevant documents for sidebar
      setRelevantDocuments(ragResponse.sources.map(source => ({
        title: source.fileName || 'Document',
        content: source.content,
        metadata: {
          fileName: source.fileName,
          chunkIndex: source.chunkIndex,
          relevanceScore: source.relevanceScore
        }
      })));
      
      // Add assistant message to chat
      const assistantMessage = createAssistantMessage(ragResponse.answer);
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('❌ Error generating response:', error);
      
      // Add error message that still acts as helpful assistant
      const errorMessage = createAssistantMessage(
        "I'm sorry, but I encountered a technical issue while processing your request. However, I'm still here to help! Could you please try rephrasing your question or ask me something else? I can assist with Samsung PRISM program information, technical questions, or general inquiries."
      );
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="chat-title">
          <h1>Samsung PRISM AI Assistant</h1>
          <p>Ask me anything about Samsung PRISM program</p>
        </div>
      </div>
      
      <div className="chat-content">
        <div className="chat-main">
          <ChatHistory messages={messages} loading={loading} />
          <ChatInput onSendMessage={handleSendMessage} disabled={loading} />
        </div>
        
        <div className="chat-sidebar">
          <DocumentViewer documents={relevantDocuments} />
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
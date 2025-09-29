import { ProcessedFile } from '../types';
import { fileAPI, chatAPI } from './api';

export interface UploadedFileResult {
  fileId: string;
  fileName: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
}

// Upload files to backend for RAG processing
export const uploadFilesForRAG = async (files: File[]): Promise<UploadedFileResult[]> => {
  const results: UploadedFileResult[] = [];
  
  for (const file of files) {
    try {
      console.log(`📤 Uploading file to backend: ${file.name}`);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fileAPI.uploadFile(formData);
      
      if (response.data && response.data.success) {
        const fileData = response.data.data.file;
        console.log(`✅ File uploaded successfully: ${file.name}`, fileData);
        
        results.push({
          fileId: fileData.id,
          fileName: file.name,
          status: fileData.status || 'processing'
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error(`❌ Failed to upload file ${file.name}:`, error);
      results.push({
        fileId: '',
        fileName: file.name,
        status: 'failed'
      });
    }
  }
  
  return results;
};

// Generate RAG response with file context
export const generateRAGResponse = async (
  query: string, 
  uploadedFiles?: UploadedFileResult[]
): Promise<{
  answer: string;
  sources: Array<{
    content: string;
    fileName: string;
    chunkIndex: number;
    relevanceScore: number;
  }>;
}> => {
  try {
    console.log('🤖 Generating RAG response with query:', query);
    console.log('📄 Uploaded files:', uploadedFiles?.length || 0);
    
    // Create enhanced query that includes file context
    let enhancedQuery = query;
    
    if (uploadedFiles && uploadedFiles.length > 0) {
      const fileNames = uploadedFiles.map(f => f.fileName).join(', ');
      enhancedQuery = `${query} [User recently uploaded files: ${fileNames}]`;
    }
    
    const response = await chatAPI.generateResponse({ 
      query: enhancedQuery, 
      limit: 5 
    });
    
    if (response.data && response.data.success) {
      const ragData = response.data.data;
      console.log('✅ RAG response generated:', {
        answerLength: ragData.answer.length,
        sourcesCount: ragData.sources.length
      });
      
      return {
        answer: ragData.answer,
        sources: ragData.sources
      };
    } else {
      throw new Error('Invalid response from backend');
    }
  } catch (error) {
    console.error('❌ Error generating RAG response:', error);
    throw error;
  }
};

// Check file processing status
export const checkFileStatus = async (fileId: string): Promise<{
  status: string;
  processingError?: string;
}> => {
  try {
    const response = await fileAPI.getFile(fileId);
    
    if (response.data && response.data.success) {
      const fileData = response.data.data.file;
      return {
        status: fileData.status,
        processingError: fileData.processingError
      };
    } else {
      throw new Error('Failed to get file status');
    }
  } catch (error) {
    console.error('❌ Error checking file status:', error);
    return { status: 'failed' };
  }
};

// Wait for file processing to complete
export const waitForFileProcessing = async (
  fileId: string, 
  maxWaitTime: number = 30000, // 30 seconds
  checkInterval: number = 2000 // 2 seconds
): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const statusResult = await checkFileStatus(fileId);
    
    if (statusResult.status === 'completed') {
      console.log(`✅ File processing completed: ${fileId}`);
      return true;
    }
    
    if (statusResult.status === 'failed') {
      console.error(`❌ File processing failed: ${fileId}`, statusResult.processingError);
      return false;
    }
    
    // Still processing, wait and check again
    console.log(`⏳ File still processing: ${fileId}, status: ${statusResult.status}`);
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.warn(`⚠️ File processing timeout: ${fileId}`);
  return false;
};

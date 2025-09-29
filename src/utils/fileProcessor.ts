import Tesseract from 'tesseract.js';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { Document, ProcessedFile, FileAttachment } from '../types';
import { generateId } from './chatUtils';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;

// Extract text from images using OCR
export const extractTextFromImage = async (file: File): Promise<string> => {
  try {
    console.log('🖼️ Starting OCR for image:', file.name);
    
    const { data: { text } } = await Tesseract.recognize(file, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`📊 OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    const cleanedText = text.trim().replace(/\s+/g, ' ');
    console.log('✅ OCR completed for:', file.name);
    console.log('📝 Extracted text length:', cleanedText.length);
    console.log('🔍 Text preview:', cleanedText.substring(0, 200) + '...');
    
    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('No meaningful text found in image');
    }
    
    return cleanedText;
  } catch (error) {
    console.error('❌ Error extracting text from image:', error);
    throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from PDF files using PDF.js
export const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    console.log('📄 Starting PDF text extraction for:', file.name);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    console.log(`📖 PDF has ${pdf.numPages} pages`);
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`📄 Processing page ${pageNum}/${pdf.numPages}`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => {
          if (item.str && typeof item.str === 'string') {
            return item.str.trim();
          }
          return '';
        })
        .filter(text => text.length > 0)
        .join(' ');
      
      if (pageText.trim()) {
        fullText += `\n\n=== Page ${pageNum} ===\n${pageText.trim()}`;
        console.log(`✅ Page ${pageNum} extracted: ${pageText.length} characters`);
      }
    }
    
    const cleanedText = fullText.trim().replace(/\s+/g, ' ');
    console.log('✅ PDF text extraction completed for:', file.name);
    console.log('📝 Total extracted text length:', cleanedText.length);
    console.log('🔍 Text preview:', cleanedText.substring(0, 300) + '...');
    
    if (!cleanedText || cleanedText.length < 20) {
      throw new Error('No readable text found in PDF');
    }
    
    return cleanedText;
  } catch (error) {
    console.error('❌ Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from Word documents
export const extractTextFromDocx = async (file: File): Promise<string> => {
  try {
    console.log('📝 Starting DOCX text extraction for:', file.name);
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (result.messages && result.messages.length > 0) {
      console.warn('⚠️ DOCX extraction warnings:', result.messages);
    }
    
    const cleanedText = result.value.trim().replace(/\s+/g, ' ');
    console.log('✅ DOCX text extraction completed for:', file.name);
    console.log('📝 Extracted text length:', cleanedText.length);
    console.log('🔍 Text preview:', cleanedText.substring(0, 200) + '...');
    
    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('No readable text found in document');
    }
    
    return cleanedText;
  } catch (error) {
    console.error('❌ Error extracting text from DOCX:', error);
    throw new Error(`Failed to extract text from Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from plain text files
export const extractTextFromTxt = async (file: File): Promise<string> => {
  try {
    console.log('📄 Reading text file:', file.name);
    const text = await file.text();
    const cleanedText = text.trim();
    console.log('✅ Text file read completed for:', file.name);
    console.log('📝 Text length:', cleanedText.length);
    
    if (!cleanedText) {
      throw new Error('Text file is empty');
    }
    
    return cleanedText;
  } catch (error) {
    console.error('❌ Error reading text file:', error);
    throw new Error(`Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Improved chunking with better overlap and size management
export const chunkText = (text: string, chunkSize: number = 800, overlap: number = 100): string[] => {
  if (!text || text.trim().length === 0) {
    console.log('⚠️ No text to chunk');
    return [];
  }

  console.log(`🔧 Chunking text of length ${text.length} into chunks of ${chunkSize} with ${overlap} overlap`);
  
  // Split into sentences first for better semantic chunks
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    // If adding this sentence would exceed chunk size, save current chunk
    if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap from previous chunk
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.min(overlap, words.length)).join(' ');
      currentChunk = overlapWords + ' ' + trimmedSentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // If no chunks were created (very short text), return the original text as one chunk
  if (chunks.length === 0 && text.trim()) {
    chunks.push(text.trim());
  }
  
  console.log(`✅ Created ${chunks.length} chunks from text`);
  chunks.forEach((chunk, index) => {
    console.log(`📄 Chunk ${index + 1}: ${chunk.length} characters - "${chunk.substring(0, 50)}..."`);
  });
  
  return chunks;
};

// Process uploaded file and extract content
export const processFile = async (file: File): Promise<ProcessedFile> => {
  const fileId = generateId();
  let extractedText = '';
  
  console.log('🚀 Starting file processing:', {
    name: file.name,
    type: file.type,
    size: file.size
  });
  
  try {
    // Extract text based on file type
    if (file.type.startsWith('image/')) {
      console.log('🖼️ Processing as image file');
      extractedText = await extractTextFromImage(file);
    } else if (file.type === 'application/pdf') {
      console.log('📄 Processing as PDF file');
      extractedText = await extractTextFromPDF(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('📝 Processing as Word document');
      extractedText = await extractTextFromDocx(file);
    } else if (file.type === 'text/plain') {
      console.log('📄 Processing as text file');
      extractedText = await extractTextFromTxt(file);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    console.log('✅ Text extraction completed');
    console.log('📊 Extracted text stats:', {
      length: extractedText.length,
      wordCount: extractedText.split(/\s+/).length,
      preview: extractedText.substring(0, 300) + '...'
    });
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from this file');
    }

    // Chunk the extracted text
    const textChunks = chunkText(extractedText);
    
    if (textChunks.length === 0) {
      throw new Error('Failed to create text chunks from extracted content');
    }
    
    // Create document chunks for vector storage
    const chunks: Document[] = textChunks.map((chunk, index) => ({
      id: `${fileId}_chunk_${index}`,
      title: `${file.name} - Section ${index + 1}`,
      content: chunk,
      metadata: {
        source: 'Uploaded File',
        date_added: new Date(),
        tags: ['uploaded', 'user-content'],
        page: index + 1,
        fileName: file.name
      }
    }));

    const result: ProcessedFile = {
      id: fileId,
      name: file.name,
      type: file.type,
      extractedText,
      chunks,
      processingStatus: 'completed'
    };
    
    console.log('🎉 File processing completed successfully!');
    console.log('📊 Final processing stats:', {
      fileName: result.name,
      extractedTextLength: result.extractedText.length,
      chunksCount: result.chunks.length,
      status: result.processingStatus,
      firstChunkPreview: result.chunks[0]?.content.substring(0, 100) + '...'
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error processing file:', file.name, error);
    return {
      id: fileId,
      name: file.name,
      type: file.type,
      extractedText: '',
      chunks: [],
      processingStatus: 'error'
    };
  }
};

// Create file attachment from uploaded file
export const createFileAttachment = (file: File): FileAttachment => {
  return {
    id: generateId(),
    name: file.name,
    type: file.type,
    size: file.size,
    url: URL.createObjectURL(file)
  };
};

// Check if file type is supported
export const isSupportedFileType = (file: File): boolean => {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  return supportedTypes.includes(file.type);
};

// Get file type display name
export const getFileTypeDisplayName = (fileType: string): string => {
  const typeMap: { [key: string]: string } = {
    'image/jpeg': 'JPEG Image',
    'image/jpg': 'JPG Image',
    'image/png': 'PNG Image',
    'image/gif': 'GIF Image',
    'image/webp': 'WebP Image',
    'image/bmp': 'BMP Image',
    'application/pdf': 'PDF Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'text/plain': 'Text File'
  };
  
  return typeMap[fileType] || 'Unknown File Type';
};
import Tesseract from 'tesseract.js';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import fs from 'fs/promises';
import path from 'path';
import { File, IFile } from '../models/File';
import { Document, IDocument } from '../models/Document';
import { vectorStore } from './vectorStore';

export interface ProcessingResult {
  success: boolean;
  text?: string;
  error?: string;
  chunks?: any[];
}

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  metadata: {
    source: string;
    page?: number;
    section?: string;
    tags: string[];
    fileName: string;
  };
}

// Extract text from images using OCR
export const extractTextFromImage = async (filePath: string): Promise<string> => {
  try {
    console.log('🖼️ Starting OCR for image:', filePath);
    
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`📊 OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    const cleanedText = text.trim().replace(/\s+/g, ' ');
    console.log('✅ OCR completed for:', filePath);
    console.log('📝 Extracted text length:', cleanedText.length);
    
    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('No meaningful text found in image');
    }
    
    return cleanedText;
  } catch (error) {
    console.error('❌ Error extracting text from image:', error);
    throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from PDF files
export const extractTextFromPDF = async (filePath: string): Promise<string> => {
  try {
    console.log('📄 Starting PDF text extraction for:', filePath);
    
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    
    console.log(`📖 PDF has ${data.numpages} pages`);
    console.log('✅ PDF text extraction completed for:', filePath);
    console.log('📝 Extracted text length:', data.text.length);
    
    if (!data.text || data.text.trim().length < 20) {
      throw new Error('No readable text found in PDF');
    }
    
    return data.text.trim();
  } catch (error) {
    console.error('❌ Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from Word documents
export const extractTextFromDocx = async (filePath: string): Promise<string> => {
  try {
    console.log('📝 Starting DOCX text extraction for:', filePath);
    
    const dataBuffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    
    if (result.messages && result.messages.length > 0) {
      console.warn('⚠️ DOCX extraction warnings:', result.messages);
    }
    
    const cleanedText = result.value.trim().replace(/\s+/g, ' ');
    console.log('✅ DOCX text extraction completed for:', filePath);
    console.log('📝 Extracted text length:', cleanedText.length);
    
    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('No text could be extracted from DOCX file');
    }
    
    return cleanedText;
  } catch (error) {
    console.error('❌ Error extracting text from DOCX:', error);
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from text files
export const extractTextFromTxt = async (filePath: string): Promise<string> => {
  try {
    console.log('📄 Starting TXT text extraction for:', filePath);
    
    const text = await fs.readFile(filePath, 'utf-8');
    const cleanedText = text.trim().replace(/\s+/g, ' ');
    
    console.log('✅ TXT text extraction completed for:', filePath);
    console.log('📝 Extracted text length:', cleanedText.length);
    
    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('No meaningful text found in file');
    }
    
    return cleanedText;
  } catch (error) {
    console.error('❌ Error extracting text from TXT:', error);
    throw new Error(`Failed to extract text from TXT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from Excel files using ExcelJS
export const extractTextFromExcel = async (filePath: string): Promise<string> => {
  try {
    console.log('📆 Starting Excel text extraction for:', filePath);
    
    // Validate file exists and is readable
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error(`Excel file is empty: ${filePath}`);
    }
    
    console.log(`📊 File size: ${stats.size} bytes`);
    
    // Check if file is actually an Excel file by checking first few bytes
    const buffer = fs.readFileSync(filePath);
    const fileSignature = buffer.slice(0, 4);
    
    // Excel files should start with PK signature (ZIP format) for .xlsx
    // or with specific OLE signatures for .xls
    const isValidExcel = buffer.toString('hex', 0, 2) === '504b' || // PK for .xlsx
                        buffer.toString('hex', 0, 8) === 'd0cf11e0a1b11ae1'; // OLE for .xls
    
    if (!isValidExcel) {
      throw new Error(`File does not appear to be a valid Excel file: ${filePath}`);
    }
    
    console.log('✅ File validation passed');
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    let extractedText = '';
    let sheetCount = 0;
    
    // Process each worksheet
    workbook.eachSheet((worksheet, sheetId) => {
      if (sheetCount > 0) extractedText += '\n\n';
      extractedText += `Sheet: ${worksheet.name}\n`;
      
      // Extract text from each row
      worksheet.eachRow((row, rowNumber) => {
        const rowValues: string[] = [];
        row.eachCell((cell, colNumber) => {
          if (cell.value !== null && cell.value !== undefined) {
            // Handle different cell types
            let cellText = '';
            const cellValue = cell.value as any;
            
            if (cellValue && typeof cellValue === 'object') {
              if (cellValue.result !== undefined) {
                // Formula result
                cellText = String(cellValue.result);
              } else if (cellValue.text !== undefined) {
                // Rich text
                cellText = cellValue.text;
              } else if (cellValue.richText) {
                // Rich text array
                cellText = cellValue.richText.map((rt: any) => rt.text).join('');
              } else {
                // Other object types (Date, etc.)
                cellText = String(cellValue);
              }
            } else {
              // Simple value (string, number, boolean)
              cellText = String(cell.value);
            }
            
            if (cellText.trim()) {
              rowValues.push(cellText.trim());
            }
          }
        });
        
        if (rowValues.length > 0) {
          extractedText += rowValues.join(' | ') + '\n';
        }
      });
      
      sheetCount++;
    });
    
    const cleanedText = extractedText.trim().replace(/\s+/g, ' ');
    
    console.log('✅ Excel text extraction completed for:', filePath);
    console.log('📝 Extracted text length:', cleanedText.length);
    console.log('📆 Number of sheets:', sheetCount);
    
    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('No meaningful text found in Excel file');
    }
    
    return cleanedText;
  } catch (error) {
    console.error('❌ Error extracting text from Excel:', error);
    throw new Error(`Failed to extract text from Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Chunk text into smaller pieces for better processing
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

// Process file and extract content
export const processFile = async (file: IFile): Promise<ProcessingResult> => {
  try {
    console.log('🚀 Starting file processing:', {
      id: file._id,
      name: file.originalName,
      type: file.fileType,
      size: file.size
    });

    let extractedText = '';

    // Extract text based on file type
    switch (file.fileType) {
      case 'image':
        extractedText = await extractTextFromImage(file.filePath);
        break;
      case 'pdf':
        extractedText = await extractTextFromPDF(file.filePath);
        break;
      case 'docx':
        extractedText = await extractTextFromDocx(file.filePath);
        break;
      case 'txt':
        extractedText = await extractTextFromTxt(file.filePath);
        break;
      case 'xlsx':
      case 'xls':
        extractedText = await extractTextFromExcel(file.filePath);
        break;
      default:
        throw new Error(`Unsupported file type: ${file.fileType}`);
    }

    console.log('✅ Text extraction completed');
    console.log('📊 Extracted text stats:', {
      length: extractedText.length,
      wordCount: extractedText.split(/\s+/).length,
      preview: extractedText.substring(0, 300) + '...'
    });

    // Chunk the extracted text
    const textChunks = chunkText(extractedText);
    
    if (textChunks.length === 0) {
      throw new Error('Failed to create text chunks from extracted content');
    }

    // Create document chunks for storage
    const chunks: DocumentChunk[] = textChunks.map((chunk, index) => ({
      content: chunk,
      chunkIndex: index,
      metadata: {
        source: `uploaded file: ${file.originalName}`,
        fileName: file.originalName,
        tags: ['uploaded', file.fileType]
      }
    }));

    console.log(`✅ Successfully processed file into ${chunks.length} chunks`);

    return {
      success: true,
      text: extractedText,
      chunks
    };

  } catch (error) {
    console.error('❌ Error processing file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Save document chunks to database and generate embeddings
export const saveDocumentChunks = async (
  userId: string | null,
  fileId: string,
  chunks: DocumentChunk[]
): Promise<void> => {
  try {
    console.log(`💾 Saving ${chunks.length} document chunks to database`);

    const documents = chunks.map(chunk => ({
      userId,
      fileId,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      metadata: chunk.metadata
    }));

    // Insert documents first
    const savedDocuments = await Document.insertMany(documents);
    console.log('✅ Successfully saved document chunks to database');

    // Generate embeddings for each document chunk
    console.log('🧮 Starting embedding generation for document chunks...');
    
    try {
      // Initialize vector store if needed
      await vectorStore.initialize();
      
      // Generate embeddings for all chunks
      const textContents = chunks.map(chunk => chunk.content);
      const embeddingResults = await vectorStore.generateBatchEmbeddings(textContents);
      
      // Update documents with their embeddings
      const updatePromises = embeddingResults.map(async (result, index) => {
        if (savedDocuments[index]) {
          return vectorStore.storeEmbedding(
            (savedDocuments[index] as any)._id.toString(),
            result.embedding
          );
        }
      });
      
      await Promise.all(updatePromises.filter(Boolean));
      
      console.log(`✅ Successfully generated and stored embeddings for ${embeddingResults.length} document chunks`);
    } catch (embeddingError) {
      console.error('❌ Warning: Failed to generate embeddings, but documents were saved:', embeddingError);
      // Don't throw here - documents are saved, embeddings can be generated later if needed
    }
  } catch (error) {
    console.error('❌ Error saving document chunks:', error);
    throw new Error(`Failed to save document chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Main processing function
export const processAndSaveFile = async (fileId: string): Promise<void> => {
  try {
    console.log(`🔄 Starting processing for file: ${fileId}`);

    // Get file from database
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // Update file status to processing
    await File.findByIdAndUpdate(fileId, { status: 'processing' });

    // Process the file
    const result = await processFile(file);

    if (!result.success || !result.chunks) {
      // Update file status to failed
      await File.findByIdAndUpdate(fileId, {
        status: 'failed',
        processingError: result.error
      });
      throw new Error(result.error || 'Processing failed');
    }

    // Save document chunks to database
    const userId = file.userId ? file.userId.toString() : null;
    await saveDocumentChunks(userId, fileId, result.chunks);

    // Update file status to completed
    await File.findByIdAndUpdate(fileId, {
      status: 'completed',
      processedAt: new Date()
    });

    console.log(`✅ Successfully processed and saved file: ${fileId}`);

  } catch (error) {
    console.error('❌ Error in processAndSaveFile:', error);
    
    // Update file status to failed
    await File.findByIdAndUpdate(fileId, {
      status: 'failed',
      processingError: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
};

import { pipeline, env } from '@xenova/transformers';
import { Document, IDocument } from '../models/Document';

// Configure Xenova transformers environment
// Allow remote models initially to download, then can be cached locally
env.allowRemoteModels = true;
env.allowLocalModels = true;
// Set cache directory for models
env.cacheDir = './models-cache';

export interface VectorSearchResult {
  document: IDocument;
  similarity: number;
}

export interface EmbeddingResult {
  embedding: number[];
  text: string;
}

class VectorStoreService {
  private embeddingPipeline: any = null;
  private isInitialized = false;
  private readonly EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
  private readonly SIMILARITY_THRESHOLD = 0.3;

  /**
   * Initialize the embedding pipeline
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🚀 Initializing vector store service...');
      console.log(`📦 Loading embedding model: ${this.EMBEDDING_MODEL}`);
      
      // Initialize the sentence embedding pipeline
      this.embeddingPipeline = await pipeline(
        'feature-extraction',
        this.EMBEDDING_MODEL
      );
      
      this.isInitialized = true;
      console.log('✅ Vector store service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize vector store service:', error);
      throw new Error(`Vector store initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embedding for a text chunk
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Clean and prepare text
      const cleanText = text.trim().replace(/\s+/g, ' ');
      if (!cleanText) {
        throw new Error('Empty text provided for embedding generation');
      }

      console.log('🧮 Generating embedding for text snippet:', cleanText.substring(0, 100) + '...');
      
      // Generate embedding
      const result = await this.embeddingPipeline(cleanText, {
        pooling: 'mean',
        normalize: true
      });

      // Extract the embedding array
      let embedding: number[];
      if (Array.isArray(result.data)) {
        embedding = Array.from(result.data);
      } else if (result.data && typeof result.data[Symbol.iterator] === 'function') {
        embedding = Array.from(result.data);
      } else {
        throw new Error('Invalid embedding format received');
      }

      console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple text chunks
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    console.log(`🔄 Generating embeddings for ${texts.length} text chunks`);
    
    const results: EmbeddingResult[] = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await this.generateEmbedding(texts[i]);
        results.push({
          embedding,
          text: texts[i]
        });
        
        // Log progress
        if ((i + 1) % 5 === 0 || i === texts.length - 1) {
          console.log(`📊 Embedding progress: ${i + 1}/${texts.length} completed`);
        }
      } catch (error) {
        console.error(`❌ Failed to generate embedding for chunk ${i}:`, error);
        // Continue with other chunks even if one fails
        continue;
      }
    }
    
    console.log(`✅ Successfully generated ${results.length}/${texts.length} embeddings`);
    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match for similarity calculation');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Search for similar documents using vector similarity
   */
  async searchSimilarDocuments(
    userId: string,
    queryText: string,
    limit: number = 5
  ): Promise<VectorSearchResult[]> {
    try {
      console.log('🔍 Starting vector similarity search...');
      console.log('🔍 Query:', queryText);
      console.log('🔍 User ID:', userId);
      console.log('🔍 Limit:', limit);

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(queryText);
      console.log(`🧮 Query embedding generated with ${queryEmbedding.length} dimensions`);

      // Find all documents with embeddings for this user and system docs
      const documentsQuery = {
        $or: [
          { userId: null }, // System documents
          { userId }        // User documents
        ],
        embedding: { $exists: true, $ne: null }
      };

      const documents = await Document.find(documentsQuery)
        .populate('fileId', 'originalName')
        .lean();

      console.log(`📚 Found ${documents.length} documents with embeddings to search`);

      if (documents.length === 0) {
        console.log('⚠️ No documents with embeddings found');
        return [];
      }

      // Calculate similarity scores for each document
      const results: VectorSearchResult[] = [];
      let validDocuments = 0;
      let skippedDocuments = 0;

      for (const doc of documents) {
        if (!doc.embedding || !Array.isArray(doc.embedding)) {
          console.warn(`⚠️ Document ${doc._id} has invalid embedding, skipping`);
          skippedDocuments++;
          continue;
        }

        // Validate embedding dimensions match query embedding
        if (doc.embedding.length !== queryEmbedding.length) {
          console.warn(`⚠️ Document ${doc._id} has mismatched embedding dimensions (${doc.embedding.length} vs ${queryEmbedding.length}), skipping`);
          skippedDocuments++;
          continue;
        }

        // Validate embedding contains valid numbers
        if (doc.embedding.some(val => typeof val !== 'number' || isNaN(val))) {
          console.warn(`⚠️ Document ${doc._id} has invalid embedding values, skipping`);
          skippedDocuments++;
          continue;
        }

        try {
          const similarity = this.calculateCosineSimilarity(queryEmbedding, doc.embedding);
          validDocuments++;
          
          if (similarity >= this.SIMILARITY_THRESHOLD) {
            results.push({
              document: doc as IDocument,
              similarity
            });
          }
        } catch (error) {
          console.error(`❌ Error calculating similarity for document ${doc._id}:`, error);
          skippedDocuments++;
          continue;
        }
      }
      
      console.log(`📊 Processed ${validDocuments} valid documents, skipped ${skippedDocuments} invalid ones`);

      // Sort by similarity score (descending) and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      const limitedResults = results.slice(0, limit);

      console.log(`✅ Vector search completed: ${limitedResults.length} results found`);
      limitedResults.forEach((result, index) => {
        const fileName = (result.document as any).fileId?.originalName || result.document.metadata?.fileName || 'Unknown';
        console.log(`📄 ${index + 1}. ${fileName} (chunk ${result.document.chunkIndex}) - Similarity: ${result.similarity.toFixed(4)}`);
      });

      return limitedResults;
    } catch (error) {
      console.error('❌ Error in vector similarity search:', error);
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store embedding in document
   */
  async storeEmbedding(documentId: string, embedding: number[]): Promise<void> {
    try {
      await Document.findByIdAndUpdate(documentId, {
        embedding,
        updatedAt: new Date()
      });
      console.log(`✅ Embedding stored for document: ${documentId}`);
    } catch (error) {
      console.error(`❌ Error storing embedding for document ${documentId}:`, error);
      throw new Error(`Failed to store embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove embeddings for documents associated with a file
   */
  async removeEmbeddingsForFile(fileId: string): Promise<void> {
    try {
      console.log(`🗑️ Removing embeddings for file: ${fileId}`);
      
      const result = await Document.updateMany(
        { fileId },
        { 
          $unset: { embedding: 1 },
          updatedAt: new Date()
        }
      );

      console.log(`✅ Removed embeddings from ${result.modifiedCount} documents`);
    } catch (error) {
      console.error(`❌ Error removing embeddings for file ${fileId}:`, error);
      throw new Error(`Failed to remove embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up invalid embeddings from the database
   */
  async cleanupInvalidEmbeddings(): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    try {
      console.log('🧽 Cleaning up invalid embeddings...');
      
      const documentsWithEmbeddings = await Document.find({
        embedding: { $exists: true, $ne: null }
      });
      
      let cleaned = 0;
      const errors: string[] = [];
      
      for (const doc of documentsWithEmbeddings) {
        let shouldClean = false;
        
        if (!Array.isArray(doc.embedding)) {
          shouldClean = true;
          errors.push(`Document ${doc._id}: embedding is not an array`);
        } else if (doc.embedding.length === 0) {
          shouldClean = true;
          errors.push(`Document ${doc._id}: embedding is empty`);
        } else if (doc.embedding.some(val => typeof val !== 'number' || isNaN(val))) {
          shouldClean = true;
          errors.push(`Document ${doc._id}: embedding contains invalid values`);
        }
        
        if (shouldClean) {
          await Document.findByIdAndUpdate(doc._id, {
            $unset: { embedding: 1 },
            updatedAt: new Date()
          });
          cleaned++;
        }
      }
      
      console.log(`✅ Cleaned up ${cleaned} invalid embeddings`);
      return { cleaned, errors };
    } catch (error) {
      console.error('❌ Error cleaning up embeddings:', error);
      throw new Error(`Failed to cleanup embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    totalDocuments: number;
    documentsWithEmbeddings: number;
    documentsWithoutEmbeddings: number;
    embeddingCoverage: number;
  }> {
    try {
      const totalDocuments = await Document.countDocuments();
      const documentsWithEmbeddings = await Document.countDocuments({
        embedding: { $exists: true, $ne: null }
      });
      const documentsWithoutEmbeddings = totalDocuments - documentsWithEmbeddings;
      const embeddingCoverage = totalDocuments > 0 ? (documentsWithEmbeddings / totalDocuments) * 100 : 0;

      return {
        totalDocuments,
        documentsWithEmbeddings,
        documentsWithoutEmbeddings,
        embeddingCoverage
      };
    } catch (error) {
      console.error('❌ Error getting embedding stats:', error);
      throw new Error(`Failed to get embedding stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Create and export a singleton instance
export const vectorStore = new VectorStoreService();

// Export the class for testing purposes
export { VectorStoreService };

import axios from 'axios';
import { Document, IDocument } from '../models/Document';
import { vectorStore, VectorSearchResult } from './vectorStore';
import { 
  searchProjects, 
  searchExactProject,
  formatProjectResultsForRAG, 
  isProjectRelatedQuery,
  ProjectSearchResult 
} from './projectSearchService';

export interface SearchResult {
  document: IDocument;
  relevanceScore: number;
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    content: string;
    fileName: string;
    chunkIndex: number;
    relevanceScore: number;
  }>;
  query: string;
}

// Simple similarity function
const calculateSimilarity = (query: string, content: string): number => {
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const contentWords = content.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  if (queryWords.length === 0) return 0;
  
  let matches = 0;
  queryWords.forEach(word => {
    if (contentWords.some(contentWord => contentWord.includes(word))) {
      matches++;
    }
  });
  
  return matches / queryWords.length;
};

// Search documents using vector similarity or fallback to text search
export const searchDocuments = async (
  userId: string,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> => {
  try {
    console.log('🔍 ===== RAG DOCUMENT SEARCH =====');
    console.log('🔍 Searching documents for user:', userId);
    console.log('🔍 Query:', query);
    console.log('🔍 Limit:', limit);

    try {
      // Try vector-based search first
      console.log('🧮 Attempting vector similarity search...');
      const vectorResults = await vectorStore.searchSimilarDocuments(userId, query, limit);
      
      if (vectorResults.length > 0) {
        console.log(`✅ Vector search returned ${vectorResults.length} results`);
        
        // Convert vector results to SearchResult format
        const searchResults: SearchResult[] = vectorResults.map(vResult => ({
          document: vResult.document,
          relevanceScore: vResult.similarity
        }));
        
        return searchResults;
      } else {
        console.log('⚠️ Vector search returned no results, falling back to text search');
      }
    } catch (vectorError) {
      console.error('❌ Vector search failed, falling back to text search:', vectorError);
    }

    // Fallback to text-based search
    console.log('🔤 Using text-based search as fallback...');
    
    // Search both system files and user-specific documents
    const systemDocuments = await Document.find({ userId: null }).populate('fileId', 'originalName');
    const userDocuments = await Document.find({ userId }).populate('fileId', 'originalName');

    console.log('📚 Found system documents:', systemDocuments.length);
    console.log('📚 Found user documents:', userDocuments.length);

    const allDocuments = [...systemDocuments, ...userDocuments];
    console.log('📚 Total documents to search:', allDocuments.length);

    if (allDocuments.length === 0) {
      return [];
    }

    const scoredDocuments = allDocuments.map(doc => ({
      document: doc,
      relevanceScore: calculateSimilarity(query, doc.content)
    }));

    const textResults = scoredDocuments
      .filter(result => result.relevanceScore > 0.1)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
    
    console.log(`✅ Text search returned ${textResults.length} results`);
    return textResults;
  } catch (error) {
    console.error('❌ Error searching documents:', error);
    throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Generate response using Ollama with combined document and project context
export const generateResponse = async (
  query: string,
  relevantDocs: SearchResult[],
  projectResults?: ProjectSearchResult[]
): Promise<string> => {
  try {
    console.log('🤖 Generating response with Ollama API');

    let context = '';
    let prompt = '';

    // Build context from both documents and project data
    let hasContent = false;

    if (relevantDocs.length > 0) {
      // Limit context to most relevant chunks and truncate long content
      const docContext = relevantDocs
        .slice(0, 3) // Only use top 3 most relevant documents
        .map(result => {
          const doc = result.document;
          const fileName = (doc as any).fileId?.originalName || doc.metadata.fileName;
          // Truncate content to avoid overwhelming context
          const truncatedContent = doc.content.length > 500 
            ? doc.content.substring(0, 500) + '...' 
            : doc.content;
          return `[Source: ${fileName}]\n${truncatedContent}`;
        })
        .join('\n\n---\n\n');
      
      context += docContext;
      hasContent = true;
    }

    // Add project data if available
    if (projectResults && projectResults.length > 0) {
      const projectContext = formatProjectResultsForRAG(projectResults.slice(0, 5));
      if (projectContext) {
        if (hasContent) {
          context += '\n\n=== PROJECT INFORMATION ===\n\n';
        }
        context += projectContext;
        hasContent = true;
      }
    }

    if (hasContent) {
      // Check if this is a specific worklet query
      const isWorkletQuery = query.toLowerCase().includes('worklet') && query.match(/\b0*(\d{1,3})\b/);
      
      if (isWorkletQuery && projectResults && projectResults.length > 0) {
        prompt = `You are the Samsung PRISM AI Assistant. Provide detailed information about the requested worklet using ONLY the provided context.

Context:
${context}

Question: ${query}

Instructions:
- Format the response as a professional, well-structured answer
- Start with a brief introduction: "Here's the information about [worklet title]:"
- Present the details in a clear, organized manner using sections:
  📋 **Worklet Details**
  🏛️ **Institution & Team**
  📊 **Current Status**
- Use bullet points or structured formatting for clarity
- Include all available information: title, domain, mentors, students, professors, status, stage
- Use emojis sparingly to enhance readability
- End with a helpful closing statement
- Only use information from the provided context
- Make it sound natural and conversational, like a knowledgeable assistant

Answer:`;
      } else if (relevantDocs.length > 0 && (!projectResults || projectResults.length === 0)) {
        // Document-only response (no project data)
        prompt = `You are the Samsung PRISM AI Assistant. Answer the user's question using ONLY the provided document context.

Context:
${context}

Question: ${query}

Instructions:
- Provide a clear, helpful response based on the uploaded documents
- Reference the source document when providing information
- Use professional language appropriate for a corporate AI assistant
- Structure your answer clearly with proper formatting when helpful
- If the context doesn't fully answer the question, say "Based on the uploaded documents, [answer what you can]"
- Be conversational while staying professional
- Focus on the document content and don't mix in general knowledge

Answer:`;
      } else {
        // Mixed content or project-only response
        prompt = `You are the Samsung PRISM AI Assistant. Answer the user's question professionally using ONLY the provided context.

Context:
${context}

Question: ${query}

Instructions:
- Provide a clear, well-formatted response (2-4 sentences)
- Use professional language appropriate for a corporate AI assistant
- Structure your answer with proper formatting when helpful
- For project queries, present information in an organized manner
- Reference specific details when available (worklet IDs, mentors, students, status)
- Mention the source file if referencing uploaded content
- If context doesn't contain the answer, say "I don't have that specific information in the available data"
- Be helpful and conversational while staying professional
- Use appropriate formatting (bullet points, sections) for complex information

Answer:`;
      }
    } else {
      prompt = `You are the Samsung PRISM AI Assistant.

Question: ${query}

Instructions:
- Provide a helpful, professional response (2-3 sentences)
- If about Samsung PRISM, share relevant information in a conversational manner
- Use a warm, approachable tone while maintaining professionalism
- If the question is unclear, ask for clarification politely
- Structure your response clearly and be genuinely helpful

Answer:`;
    }

    console.log('🚀 Sending request to Ollama...');

    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'phi',
      prompt,
      stream: false,
      options: {
        temperature: 0.3,     // Lower temperature for more focused responses
        top_p: 0.7,          // Reduced top_p for less randomness
        repeat_penalty: 1.1,  // Slightly lower repeat penalty for natural flow
        num_ctx: 2048,       // Context window for processing
        stop: ['\n\n\n', '---', 'Question:', 'Context:'], // Stop tokens to prevent rambling
        num_predict: 250     // Increased limit for better formatted responses
      }
    }, {
      timeout: 30000
    });

    if (!response.data || !response.data.response) {
      throw new Error('Invalid response format from Ollama');
    }

    const generatedResponse = response.data.response.trim();
    console.log('✅ Response received from Ollama');

    return generatedResponse;
  } catch (error) {
    console.error('❌ Error generating response:', error);

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('Failed to fetch')) {
        return "I apologize, but I'm unable to connect to the AI model. Please ensure Ollama is running locally with the command `ollama serve` and that the phi model is available. However, I can still help you with general questions about Samsung PRISM!";
      }
    }

    return "I apologize, but I encountered a technical issue while processing your request. However, I'm still here to help! Could you please try rephrasing your question or ask me something else?";
  }
};

// Main RAG function with combined document and project search
export const generateRAGResponse = async (
  userId: string,
  query: string,
  limit: number = 5
): Promise<RAGResponse> => {
  try {
    console.log('🔄 Starting enhanced RAG response generation');
    console.log('🔍 Query:', query);
    console.log('👤 User ID:', userId);

    // Get user information for role-based access control
    const User = require('../models/User').User;
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    console.log('👤 User role:', user.role);
    console.log('📧 User email:', user.email);

    // Search documents first
    let relevantDocs: SearchResult[] = [];
    try {
      relevantDocs = await searchDocuments(userId, query, limit);
      console.log(`📚 Found ${relevantDocs.length} relevant documents`);
    } catch (docError) {
      console.error('❌ Error searching documents:', docError);
      // Continue with empty document results rather than failing completely
      relevantDocs = [];
    }

    // Search projects only if no relevant documents found OR if it's a specific worklet ID query
    let projectResults: ProjectSearchResult[] = [];
    const workletIdMatch = query.match(/\b0*(\d{1,3})\b/);
    const isSpecificWorkletQuery = query.toLowerCase().includes('worklet') && workletIdMatch;
    
    // Only search projects if:
    // 1. No documents found AND query is project-related, OR
    // 2. It's a specific worklet ID query (like "worklet 112")
    const shouldSearchProjects = (relevantDocs.length === 0 && isProjectRelatedQuery(query)) || isSpecificWorkletQuery;
    
    if (shouldSearchProjects) {
      console.log('📊 Searching project database...');
      try {
        // Create search options with user role and email for filtering
        const projectSearchOptions = {
          limit: 10,
          userId: userId,
          userRole: user.role,
          userEmail: user.email
        };

        // Check if query contains a worklet ID (exactly 3 digits, could be 001, 1, etc.)
        if (workletIdMatch) {
          // Normalize to 3 digits (001, 002, etc.)
          const normalizedId = workletIdMatch[1].padStart(3, '0');
          console.log(`🔍 Looking for worklet ID: ${normalizedId} (from "${workletIdMatch[0]}")`);
          
          const exactResult = await searchExactProject(normalizedId, projectSearchOptions);
          if (exactResult) {
            projectResults = [exactResult];
            console.log(`🎯 Found exact project match: ${exactResult.project.workletId}`);
          } else {
            // Also try the original number without padding
            const exactResultAlt = await searchExactProject(workletIdMatch[1], projectSearchOptions);
            if (exactResultAlt) {
              projectResults = [exactResultAlt];
              console.log(`🎯 Found exact project match (alt): ${exactResultAlt.project.workletId}`);
            }
          }
        }
        
        // If no exact match found, do comprehensive search with user filtering
        if (projectResults.length === 0) {
          projectResults = await searchProjects(query, projectSearchOptions);
          console.log(`🎯 Found ${projectResults.length} relevant projects for ${user.role} user`);
        }
      } catch (projectError) {
        console.error('❌ Error searching projects:', projectError);
      }
    }

    // Generate response with both document and project context
    console.log(`📊 Generating response with ${relevantDocs.length} documents and ${projectResults.length} projects`);
    const answer = await generateResponse(query, relevantDocs, projectResults);

    // Combine sources from both documents and projects
    const documentSources = relevantDocs.map(result => {
      const doc = result.document;
      const fileName = (doc as any).fileId?.originalName || doc.metadata?.fileName || 'Unknown Document';
      return {
        content: result.document.content,
        fileName: fileName,
        chunkIndex: result.document.chunkIndex,
        relevanceScore: result.relevanceScore
      };
    });

    // Add project sources (formatted as pseudo-documents)
    const projectSources = projectResults.slice(0, 3).map((result, index) => ({
      content: `Project: ${result.project.workletTitle}\nID: ${result.project.workletId}\nDomain: ${result.project.domain}\nStatus: ${result.project.status}`,
      fileName: `Project Data - ${result.project.workletId}`,
      chunkIndex: index,
      relevanceScore: result.relevanceScore
    }));

    const allSources = [...documentSources, ...projectSources];

    console.log(`✅ Generated response with ${allSources.length} total sources`);

    return {
      answer,
      sources: allSources,
      query
    };
  } catch (error) {
    console.error('❌ Error in RAG response generation:', error);
    throw new Error(`Failed to generate RAG response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

import axios from 'axios';
import { Document, IDocument } from '../models/Document';
import { vectorStore, VectorSearchResult } from './vectorStore';
import { WorkletService } from './workletService';
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
  projectResults?: ProjectSearchResult[],
  userContext?: { user: any; workletInfo?: any },
  queryClassification?: {
    isWorkletQuery: boolean;
    isPersonalWorkletQuery: boolean;
    isGeneralProgramQuery: boolean;
  }
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

    // Add project data if available - BUT NOT for general program queries
    const { isGeneralProgramQuery } = queryClassification || { isGeneralProgramQuery: false };
    
    if (projectResults && projectResults.length > 0 && !isGeneralProgramQuery) {
      console.log('📊 Adding project context to response (not a general program query)');
      const projectContext = formatProjectResultsForRAG(projectResults.slice(0, 5));
      if (projectContext) {
        if (hasContent) {
          context += '\n\n=== PROJECT INFORMATION ===\n\n';
        }
        context += projectContext;
        hasContent = true;
      }
    } else if (projectResults && projectResults.length > 0 && isGeneralProgramQuery) {
      console.log('🚫 Skipping project context for general program query - using documents only');
    }

    if (hasContent) {
      // Use the passed query classification
      const { isWorkletQuery, isPersonalWorkletQuery, isGeneralProgramQuery } = queryClassification || {
        isWorkletQuery: false,
        isPersonalWorkletQuery: false,
        isGeneralProgramQuery: true // Default to general for safety
      };
      
      console.log(`🔍 Prompt Selection - Query: "${query}"`);
      console.log(`🔍 IsWorkletQuery: ${isWorkletQuery}`);
      console.log(`🔍 IsPersonalWorkletQuery: ${isPersonalWorkletQuery}`);
      console.log(`🔍 IsGeneralProgramQuery: ${isGeneralProgramQuery}`);
      console.log(`🔍 User role: ${userContext?.user?.role}`);
      console.log(`🔍 Has project results: ${projectResults && projectResults.length > 0}`);
      console.log(`🔍 Has relevant docs: ${relevantDocs.length > 0}`);
      
      // Check if student is asking about a different worklet ID
      if (userContext?.user?.role === 'student' && isWorkletQuery && !isPersonalWorkletQuery) {
        const workletIdMatch = query.match(/\b0*(\d{1,3})\b/);
        if (workletIdMatch) {
          const queryWorkletId = workletIdMatch[1].padStart(3, '0');
          const studentWorkletId = userContext.user.workletId?.padStart(3, '0');
          
          console.log(`🔍 Privacy check - Query: "${query}"`);
          console.log(`🔍 IsWorkletQuery: ${isWorkletQuery}`);
          console.log(`🔍 IsPersonalWorkletQuery: ${isPersonalWorkletQuery}`);
          console.log(`🔍 QueryWorkletId: ${queryWorkletId}`);
          console.log(`🔍 StudentWorkletId: ${studentWorkletId}`);
          
          if (queryWorkletId !== studentWorkletId) {
            console.log(`🔒 PRIVACY PROTECTION: Student asking about different worklet: ${queryWorkletId} (their worklet: ${studentWorkletId})`);
            
            // Return privacy-aware response
            const privacyResponse = `I understand you're asking about worklet ${queryWorkletId}, but I can only provide information about your assigned worklet (${userContext.user.workletId}). 

For privacy and security reasons, I cannot share details about other students' worklets or projects. Each worklet contains confidential information including project details, mentor assignments, and student data.

If you'd like to know more about your own worklet ${userContext.user.workletId}, I'd be happy to help! You can ask me:
- "Tell me about my worklet details"
- "Who are my mentors?"
- "What's my project status?"

What would you like to know about your worklet?`;

            return privacyResponse;
          }
        }
      }
      
      // Add student context if applicable
      let studentContext = '';
      if (userContext?.user?.role === 'student' && userContext?.workletInfo) {
        studentContext = `\n\nStudent Context:
You are responding to a student (${userContext.user.name}) who is working on worklet ${userContext.user.workletId}.
Their worklet details: ${userContext.workletInfo.title}
${userContext.workletInfo.description ? 'Description: ' + userContext.workletInfo.description : ''}
${userContext.workletInfo.mentor ? 'Mentor: ' + userContext.workletInfo.mentor : ''}
When answering questions about "my worklet", "my project", or similar personal references, refer to their specific worklet ${userContext.user.workletId}.
Always provide specific details about THEIR worklet, not general information about worklets.`;
      }
      
      // Determine the type of response needed
      console.log(`🎯 PROMPT SELECTION DEBUG:`);
      console.log(`   isGeneralProgramQuery: ${isGeneralProgramQuery}`);
      console.log(`   isPersonalWorkletQuery: ${isPersonalWorkletQuery}`);
      console.log(`   isWorkletQuery: ${isWorkletQuery}`);
      console.log(`   user.role: ${userContext?.user?.role}`);
      console.log(`   projectResults.length: ${projectResults ? projectResults.length : 0}`);
      console.log(`   relevantDocs.length: ${relevantDocs.length}`);
      
      if (isGeneralProgramQuery) {
        // General program information - answer from documents regardless of user role
        // This has the highest priority - even if project results exist, ignore them for general queries
        console.log('📝 Selected prompt type: GENERAL PROGRAM QUERY (highest priority)');
        prompt = `You are the Samsung PRISM AI Assistant. Answer the user's question using the provided context about the Samsung PRISM program.

Context:
${context}

Question: ${query}

Instructions:
- Provide a clear, helpful response based on the uploaded documents about Samsung PRISM
- Focus on general program information like eligibility, criteria, application process, overview
- Use professional language appropriate for a corporate AI assistant
- Structure your answer clearly with proper formatting when helpful
- Reference the source document when providing information
- If the context doesn't fully answer the question, say "Based on the available documents, [answer what you can]"
- Be conversational while staying professional
- This is NOT a worklet-specific query, so provide general program information

Answer:`;
      } else if (isPersonalWorkletQuery && userContext?.user?.role === 'student') {
        // Personal worklet query for students
        console.log('📝 Selected prompt type: PERSONAL WORKLET QUERY');
        prompt = `You are the Samsung PRISM AI Assistant. Answer the student's question about THEIR specific worklet using the provided context.${studentContext}

Context:
${context}

Question: ${query}

Instructions:
- This is a PERSONAL query about the student's own worklet ${userContext.user.workletId}
- Respond directly to the student using "Your worklet" and "You are working on"
- Start with: "Your worklet ${userContext.user.workletId} is..."
- Provide specific details about THEIR worklet: "${userContext.workletInfo?.title}"
- Include their domain, mentors, and current status
- Be conversational and personal, as if speaking directly to the student
- Use the student context to provide relevant, personalized information
- Do NOT provide general information about the PRISM program
- Focus specifically on their assigned project

Answer:`;
      } else if ((isWorkletQuery || isPersonalWorkletQuery) && (projectResults && projectResults.length > 0 || userContext?.user?.role === 'student')) {
        // Specific worklet ID query
        console.log('📝 Selected prompt type: SPECIFIC WORKLET ID QUERY');
        prompt = `You are the Samsung PRISM AI Assistant. Provide detailed information about the requested worklet using ONLY the provided context.${studentContext}

Context:
${context}

Question: ${query}

Instructions:
- Format the response as a professional, well-structured answer
- Start with a brief introduction about the worklet
- Present the details in a clear, organized manner
- Use bullet points or structured formatting for clarity
- Include all available information: title, domain, mentors, students, professors, status, stage
- End with a helpful closing statement
- Only use information from the provided context
- Make it sound natural and conversational, like a knowledgeable assistant

Answer:`;
      } else if (relevantDocs.length > 0 && (!projectResults || projectResults.length === 0)) {
        // Document-only response (no project data)
        console.log('📝 Selected prompt type: DOCUMENT-ONLY RESPONSE');
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
        console.log('📝 Selected prompt type: MIXED/PROJECT-ONLY RESPONSE');
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
      console.log('📝 Selected prompt type: NO CONTENT - GENERAL RESPONSE');
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
    console.log('👤 User name:', user.name);
    console.log('🔖 User worklet ID:', user.workletId || 'NOT SET');
    if (user.workletId) {
      console.log('🔖 User worklet ID:', user.workletId);
    } else {
      console.log('⚠️ No worklet ID found for user');
    }

    // Query classification variables - defined early for use throughout the function
    const workletIdMatch = query.match(/\b0*(\d{1,3})\b/);
    const isWorkletQuery = query.toLowerCase().includes('worklet') && !!workletIdMatch;
    const isPersonalWorkletQuery = query.toLowerCase().includes('my worklet') || 
                                  query.toLowerCase().includes('my project') ||
                                  query.toLowerCase().includes('tell me about my worklet') ||
                                  query.toLowerCase().includes('my worklet details') ||
                                  // When a student asks "worklet details" or "worklet id" without specifying a number, assume they mean THEIR worklet
                                  (user.role === 'student' && 
                                   (query.toLowerCase().includes('worklet details') || 
                                    query.toLowerCase().includes('tell me details about worklet id')) && 
                                   !workletIdMatch);
    
    const isGeneralProgramQuery = query.toLowerCase().includes('eligibility') ||
                                 query.toLowerCase().includes('criteria') ||
                                 query.toLowerCase().includes('program overview') ||
                                 query.toLowerCase().includes('samsung prism') ||
                                 query.toLowerCase().includes('application') ||
                                 query.toLowerCase().includes('requirements') ||
                                 query.toLowerCase().includes('how to apply') ||
                                 query.toLowerCase().includes('how to prepare') ||
                                 query.toLowerCase().includes('preparation') ||
                                 query.toLowerCase().includes('prism program') ||
                                 query.toLowerCase().includes('getting ready') ||
                                 query.toLowerCase().includes('prepare for') ||
                                 query.toLowerCase().includes('overview') ||
                                 (!query.toLowerCase().includes('worklet') && !isWorkletQuery);

    console.log(`🔍 Query Classification - Query: "${query}"`);
    console.log(`🔍 IsWorkletQuery: ${isWorkletQuery}`);
    console.log(`🔍 IsPersonalWorkletQuery: ${isPersonalWorkletQuery}`);
    console.log(`🔍 IsGeneralProgramQuery: ${isGeneralProgramQuery}`);
    console.log(`🔍 User role: ${user.role}`);

    // For students, enhance query with their worklet context
    let enhancedQuery = query;
    let studentWorkletInfo = null;
    
    if (user.role === 'student' && user.workletId) {
      console.log(`🔄 Getting worklet details for student with worklet ID: ${user.workletId}`);
      try {
        studentWorkletInfo = await WorkletService.getWorkletDetails(user.workletId);
        if (studentWorkletInfo) {
          console.log('🎯 Adding worklet context for student:', studentWorkletInfo.title);
          // Add worklet context to query for better search results
          enhancedQuery = `${query} worklet:${user.workletId}`;
        } else {
          console.log('⚠️ No worklet details found for student');
        }
      } catch (workletError) {
        console.error('⚠️ Error getting worklet details:', workletError);
      }
    } else {
      console.log(`ℹ️ User is not a student or has no workletId. Role: ${user.role}, WorkletId: ${user.workletId}`);
    }

    // Search documents first (use enhanced query for students, but NOT for general program queries)
    let relevantDocs: SearchResult[] = [];
    try {
      // For students, also search worklet-specific content - BUT NOT for general program queries
      if (user.role === 'student' && user.workletId && !isGeneralProgramQuery) {
        console.log('🎯 Student with worklet ID - adding worklet-specific content (not a general program query)');
        const workletDocs = await WorkletService.searchWorkletContent(user.workletId, query, Math.ceil(limit / 2));
        relevantDocs = await searchDocuments(userId, enhancedQuery, Math.ceil(limit / 2));
        
        // Combine worklet-specific and general search results
        const workletSearchResults = workletDocs.map(doc => ({
          document: {
            _id: doc.id,
            content: doc.content,
            metadata: {
              source: doc.source,
              fileName: doc.title,
              tags: ['worklet-specific']
            }
          } as any,
          relevanceScore: doc.relevance || 0.8 // Higher relevance for worklet-specific content
        }));
        
        relevantDocs = [...workletSearchResults, ...relevantDocs].slice(0, limit);
      } else if (user.role === 'student' && user.workletId && isGeneralProgramQuery) {
        console.log('🚫 Student with general program query - skipping worklet-specific content, using only general documents');
        relevantDocs = await searchDocuments(userId, query, limit); // Use original query, not enhanced
      } else {
        relevantDocs = await searchDocuments(userId, query, limit);
      }
      console.log(`📚 Found ${relevantDocs.length} relevant documents`);
    } catch (docError) {
      console.error('❌ Error searching documents:', docError);
      // Continue with empty document results rather than failing completely
      relevantDocs = [];
    }

    // Search projects only if no relevant documents found OR if it's a specific worklet ID query
    let projectResults: ProjectSearchResult[] = [];
    const isSpecificWorkletQuery = query.toLowerCase().includes('worklet') && workletIdMatch;
    
    // Only search projects if:
    // 1. No documents found AND query is project-related AND it's NOT a general program query, OR
    // 2. It's a specific worklet ID query (like "worklet 112")
    // 3. AND it's not a general program query (highest priority to exclude)
    const shouldSearchProjects = !isGeneralProgramQuery && 
                                ((relevantDocs.length === 0 && isProjectRelatedQuery(query)) || isSpecificWorkletQuery);
    
    console.log(`📊 Project Search Decision:`);
    console.log(`   shouldSearchProjects: ${shouldSearchProjects}`);
    console.log(`   isGeneralProgramQuery: ${isGeneralProgramQuery} (blocks if true)`);
    console.log(`   relevantDocs.length: ${relevantDocs.length}`);
    console.log(`   isProjectRelatedQuery: ${isProjectRelatedQuery(query)}`);
    console.log(`   isSpecificWorkletQuery: ${isSpecificWorkletQuery}`);
    
    if (shouldSearchProjects) {
      console.log('📊 Searching project database...');
      console.log(`📊 Reason: shouldSearchProjects=${shouldSearchProjects}, relevantDocs=${relevantDocs.length}, isProjectRelated=${isProjectRelatedQuery(query)}, isGeneralProgram=${isGeneralProgramQuery}, isSpecificWorklet=${isSpecificWorkletQuery}`);
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
    const userContext = {
      user: user,
      workletInfo: studentWorkletInfo
    };
    console.log('🔍 User context being passed to generateResponse:', {
      userId: user._id,
      role: user.role,
      name: user.name,
      workletId: user.workletId,
      hasWorkletInfo: !!studentWorkletInfo,
      workletTitle: studentWorkletInfo?.title
    });
    
    const queryClassification = {
      isWorkletQuery,
      isPersonalWorkletQuery,
      isGeneralProgramQuery
    };
    
    const answer = await generateResponse(query, relevantDocs, projectResults, userContext, queryClassification);

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

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
            
            // Return privacy-aware response with friendly, conversational tone
            const privacyResponse = `I appreciate your curiosity about worklet ${queryWorkletId}! However, I can only share information about your assigned worklet (${userContext.user.workletId}) to maintain student privacy and project confidentiality.

Each worklet in the Samsung PRISM program contains sensitive information including project details, mentor assignments, and student data that are meant to be kept private. This helps ensure that everyone's work remains secure and protected.

The good news is, I'd love to help you learn more about your own project! Your worklet ${userContext.user.workletId} has some really exciting aspects to it. Feel free to ask me things like:

• "Tell me about my worklet details"
• "Who are my mentors and how can they help me?"
• "What's the current status of my project?"
• "What are the key milestones for my worklet?"

What would you like to know about your worklet? I'm here to help you make the most of your PRISM experience!`;

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
        prompt = `You are an intelligent, friendly AI assistant for the Samsung PRISM program. Your goal is to provide helpful, conversational responses that feel natural and engaging.

Available Information:
${context}

User's Question: ${query}

Response Guidelines:
- Write in a warm, conversational tone as if you're having a helpful discussion with the user
- Start with a friendly greeting or acknowledgment of their question when appropriate
- Use smooth transitions and connecting phrases like "Let me explain...", "Here's what you need to know...", "I'd be happy to help with that..."
- Break down complex information into digestible, easy-to-understand parts
- Use natural language variations instead of robotic repetition
- When listing items, introduce them conversationally: "There are several key points to consider:" or "The program offers these benefits:"
- If information is limited, say something like "From what I can see in our program documents..." or "Based on the available information..."
- End with a helpful closing when appropriate, like "Feel free to ask if you need more details!" or "Is there anything specific about [topic] you'd like to know more about?"
- Sound like a knowledgeable, supportive human assistant, not a robot reading facts
- Use active voice and engaging language
- Avoid bullet points unless absolutely necessary - use flowing paragraphs instead

Your Response:`;
      } else if (isPersonalWorkletQuery && userContext?.user?.role === 'student') {
        // Personal worklet query for students
        console.log('📝 Selected prompt type: PERSONAL WORKLET QUERY');
        prompt = `You are a supportive, knowledgeable AI mentor for the Samsung PRISM program. You're speaking directly to a student about their personal project.${studentContext}

Available Information:
${context}

Student's Question: ${query}

Response Guidelines:
- Speak directly to the student in a warm, encouraging tone using "you" and "your"
- Start with a personalized greeting about their worklet, like "Great question about your project!" or "I'd be happy to tell you about your worklet..."
- Make them feel valued and supported in their learning journey
- Present their worklet information in an engaging, conversational way
- Use phrases like "You're working on..." or "Your project focuses on..." 
- Highlight exciting aspects of their specific worklet: "What makes your project particularly interesting is..."
- Include all relevant details naturally: mentors, domain, current status
- Make technical information accessible and relatable
- Sound enthusiastic about their project: "Your worklet ${userContext.user.workletId} is focused on ${userContext.workletInfo?.title}, which is really exciting because..."
- End with encouragement or an invitation to ask more: "You're working on something really innovative! What else would you like to know?" or "This is a fascinating area - feel free to ask about any specific aspect!"
- Be conversational and personal, like a helpful mentor having a one-on-one chat

Your Response:`;
      } else if ((isWorkletQuery || isPersonalWorkletQuery) && (projectResults && projectResults.length > 0 || userContext?.user?.role === 'student')) {
        // Specific worklet ID query
        console.log('📝 Selected prompt type: SPECIFIC WORKLET ID QUERY');
        prompt = `You are a knowledgeable AI assistant for the Samsung PRISM program. You're providing detailed information about a specific worklet project.${studentContext}

Available Information:
${context}

User's Question: ${query}

Response Guidelines:
- Write in a clear, professional yet friendly tone
- Start with an engaging introduction: "Let me tell you about this worklet..." or "This is an interesting project..."
- Present information in a flowing, narrative style rather than rigid lists
- Naturally weave together details about the project: title, domain, team members, and current progress
- Use connecting phrases like "The project is guided by..." when mentioning mentors, or "Working in the area of..." for the domain
- Make technical details accessible and interesting
- Highlight what makes this worklet unique or notable
- Use varied sentence structures to maintain engagement
- When mentioning team members, do so naturally: "The project brings together talented students including..." or "Under the mentorship of..."
- Include status updates conversationally: "The project is currently in [stage] and making great progress..."
- End with an insightful comment or invitation for questions
- Sound like an informed colleague sharing interesting project details, not reading from a database

Your Response:`;
      } else if (relevantDocs.length > 0 && (!projectResults || projectResults.length === 0)) {
        // Document-only response (no project data)
        console.log('📝 Selected prompt type: DOCUMENT-ONLY RESPONSE');
        prompt = `You are a helpful, intelligent AI assistant for the Samsung PRISM program. Your responses should feel natural and conversational.

Available Information:
${context}

User's Question: ${query}

Response Guidelines:
- Write as if you're having a friendly conversation with the user
- Begin with a natural acknowledgment: "That's a great question!" or "I can help you with that..."
- Explain concepts in a clear, accessible way using everyday language
- Use smooth transitions between ideas: "Additionally...", "What's particularly interesting is...", "Another important point..."
- When referencing documents, do it naturally: "According to the program materials..." or "From what I can see in the documentation..."
- If information is incomplete, be honest but helpful: "While I don't have all the details, here's what I can tell you..." or "Based on the available information..."
- Vary your sentence structure to sound more human and less robotic
- Use examples or analogies when they help clarify complex points
- End with a supportive statement or offer to help further
- Sound like a knowledgeable friend explaining something, not a manual being read aloud
- Keep the tone professional but warm and approachable

Your Response:`;
      } else {
        // Mixed content or project-only response
        console.log('📝 Selected prompt type: MIXED/PROJECT-ONLY RESPONSE');
        prompt = `You are a friendly, knowledgeable AI assistant for the Samsung PRISM program. Make your responses feel natural and engaging.

Available Information:
${context}

User's Question: ${query}

Response Guidelines:
- Respond in a warm, conversational manner as if chatting with a colleague
- Start with an appropriate greeting or acknowledgment: "I'd be happy to help!" or "Let me share what I know about that..."
- Present information in a flowing, narrative style rather than rigid bullet points
- Use natural language connectors: "In addition to that...", "What's interesting is...", "Building on that..."
- When discussing projects or worklets, make it engaging: "This project explores..." or "The team is working on..."
- Include specific details (IDs, names, status) but weave them into sentences naturally
- If mentioning sources, do it smoothly: "Looking at the project information..." or "From the available data..."
- If something isn't clear from the context, acknowledge it gracefully: "I don't have complete details on that, but here's what I know..."
- Use varied vocabulary and sentence structures to sound more human
- End with something helpful: an invitation to ask more, a relevant insight, or a supportive comment
- Sound like an experienced professional sharing knowledge, not a database query result
- Maintain professionalism while being approachable and personable

Your Response:`;
      }
    } else {
      console.log('📝 Selected prompt type: NO CONTENT - GENERAL RESPONSE');
      prompt = `You are a friendly, helpful AI assistant for the Samsung PRISM program. Even without specific documentation, you can provide supportive, conversational responses.

User's Question: ${query}

Response Guidelines:
- Respond in a warm, approachable tone as if you're a helpful program coordinator
- Acknowledge their question positively: "That's a great question!" or "I appreciate you asking about that..."
- If the question is about Samsung PRISM, share what you know in a conversational, engaging way
- Use natural, flowing language rather than formal or robotic phrasing
- Show empathy and understanding: "I understand you're looking for information about..."
- If you need more context, ask politely and helpfully: "To give you the most accurate information, could you tell me a bit more about..."
- Offer to help in other ways: "While I don't have specific details on that right now, I can help you with..." or "Feel free to ask me about..."
- End with encouragement and openness: "I'm here to help with any questions you have!" or "Don't hesitate to reach out if you need anything else!"
- Sound genuinely helpful and supportive, like a real person who cares about assisting
- Keep responses concise but warm (2-4 sentences)

Your Response:`;
    }

    console.log('🚀 Sending request to Ollama...');

    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'phi',
      prompt,
      stream: false,
      options: {
        temperature: 0.7,     // Increased for more natural, varied responses
        top_p: 0.9,          // Higher for more diverse word choices
        repeat_penalty: 1.15, // Slightly higher to avoid repetitive phrasing
        num_ctx: 2048,       // Context window for processing
        stop: ['\n\n\nQuestion:', '\n\n\nUser:', 'Context:', 'Instructions:', 'Response Guidelines:'], // Stop tokens to prevent prompt leakage
        num_predict: 300     // Increased for more complete, natural responses
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
        return "I'm having a bit of trouble connecting to my AI processing system at the moment. It looks like the Ollama service might not be running. If you're the admin, you can start it with the `ollama serve` command. In the meantime, I'm still here and happy to help with general questions about Samsung PRISM - just keep in mind my responses might be more limited without the full AI system!";
      }
    }

    return "Oops! I encountered a small hiccup while processing your question. Don't worry though - I'm still here to help! Could you try rephrasing your question, or feel free to ask me something else? I'm all ears and ready to assist you with the Samsung PRISM program!";
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

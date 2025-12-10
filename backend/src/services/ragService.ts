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

// Conversation memory storage (in-memory cache)
interface ConversationTurn {
  query: string;
  answer: string;
  timestamp: Date;
}

const conversationMemory: Map<string, ConversationTurn[]> = new Map();
const MAX_MEMORY_TURNS = 5; // Keep last 5 exchanges
const MEMORY_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Add conversation to memory
const addToMemory = (userId: string, query: string, answer: string) => {
  if (!conversationMemory.has(userId)) {
    conversationMemory.set(userId, []);
  }
  
  const userMemory = conversationMemory.get(userId)!;
  userMemory.push({ query, answer, timestamp: new Date() });
  
  // Keep only recent turns
  if (userMemory.length > MAX_MEMORY_TURNS) {
    userMemory.shift();
  }
  
  conversationMemory.set(userId, userMemory);
};

// Get conversation history for context
const getConversationContext = (userId: string): string => {
  const userMemory = conversationMemory.get(userId);
  if (!userMemory || userMemory.length === 0) return '';
  
  // Filter out expired conversations
  const now = new Date();
  const recentMemory = userMemory.filter(turn => 
    (now.getTime() - turn.timestamp.getTime()) < MEMORY_EXPIRY_MS
  );
  
  if (recentMemory.length === 0) {
    conversationMemory.delete(userId);
    return '';
  }
  
  // Format conversation history
  return recentMemory
    .map(turn => `User: ${turn.query}\nAssistant: ${turn.answer}`)
    .join('\n\n');
};

// Clean up expired memories periodically
setInterval(() => {
  const now = new Date();
  for (const [userId, memory] of conversationMemory.entries()) {
    const recentMemory = memory.filter(turn => 
      (now.getTime() - turn.timestamp.getTime()) < MEMORY_EXPIRY_MS
    );
    if (recentMemory.length === 0) {
      conversationMemory.delete(userId);
    } else {
      conversationMemory.set(userId, recentMemory);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

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
  },
  conversationHistory?: string
): Promise<string> => {
  try {
    console.log('🤖 Generating response with Ollama API');

    let context = '';
    let prompt = '';

    // Add conversation history for context continuity
    let conversationContext = '';
    if (conversationHistory && conversationHistory.trim().length > 0) {
      conversationContext = `\nRecent Conversation:\n${conversationHistory}\n`;
      console.log('💬 Including conversation history for context');
    }

    // Build context from both documents and project data
    let hasContent = false;

    if (relevantDocs.length > 0) {
      // Limit context to most relevant chunks and truncate long content
      const docContext = relevantDocs
        .slice(0, 5) // Use top 5 most relevant documents for better coverage
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
        prompt = `You are an AI assistant for Samsung PRISM program.
${conversationContext}
Context:
${context}

Question: ${query}

Instructions:
- Answer using ONLY facts from the context above
- Be direct and concise (1-2 short paragraphs maximum)
- State exactly what the documents say
- If information is limited, say: "Based on available documents, [what you found]"
- Do NOT create hypothetical situations (no "Consider...", "Imagine...", "Let's say...")
- Do NOT invent examples with College A/B/C, people names, or scenarios
- Do NOT make up requirements, rules, or constraints
- Do NOT create numbered lists unless they exist in the context
- Stop immediately after answering

Answer:`;
      } else if (isPersonalWorkletQuery && userContext?.user?.role === 'student') {
        // Personal worklet query for students
        console.log('📝 Selected prompt type: PERSONAL WORKLET QUERY');
        prompt = `You are an AI assistant helping a student with their Samsung PRISM project.${studentContext}

Available Information:
${context}

Student's Question: ${query}

Response Guidelines:
- Address the student directly using "you" and "your"
- Provide clear, specific information about their worklet ${userContext.user.workletId}
- Include relevant details: project title, domain, mentors, and current status
- Keep sentences concise and well-organized
- Focus on facts from the context only
- Do NOT invent details, scenarios, or hypothetical examples
- Do NOT create fictional situations or characters
- Do NOT create fake conversations (User: ... Assistant: ...)
- Do NOT invent numbered lists of people, systems, or rules
- Do NOT make up mentor IDs, project management systems, or expertise areas
- Use a supportive but professional tone
- Avoid over-enthusiasm or filler phrases
- Answer ONLY what was asked - do not expand with invented scenarios

Your Response:`;
      } else if ((isWorkletQuery || isPersonalWorkletQuery) && (projectResults && projectResults.length > 0 || userContext?.user?.role === 'student')) {
        // Specific worklet ID query
        console.log('📝 Selected prompt type: SPECIFIC WORKLET ID QUERY');
        prompt = `You are an AI assistant for Samsung PRISM program providing worklet information.${studentContext}

Context:
${context}

Question: ${query}

Instructions:
- Answer directly using only facts from the context above
- Include: worklet title, domain, institution, team members, mentors, professors, status, and review stage
- Use 1-2 short paragraphs maximum
- Be specific and factual
- Do NOT add exercises, quizzes, or questions at the end
- Do NOT create examples or scenarios
- Do NOT invent any details
- Stop immediately after providing the factual information

Answer:`;
      } else if (relevantDocs.length > 0 && (!projectResults || projectResults.length === 0)) {
        // Document-only response (no project data)
        console.log('📝 Selected prompt type: DOCUMENT-ONLY RESPONSE');
        prompt = `You are an AI assistant with access to Samsung PRISM program documents.

Available Information:
${context}

User's Question: ${query}

Response Guidelines:
- Answer based solely on the provided document content
- Cite specific information when relevant
- Use clear, direct language based on facts only
- Keep sentences concise and factual
- If documents don't contain the answer, state clearly: "This information is not in the available documents"
- Do NOT speculate or invent information beyond what's documented
- Do NOT create examples, scenarios, or hypothetical situations
- Present information in logical order
- Maintain a helpful, professional tone

Your Response:`;
      } else {
        // Mixed content or project-only response
        console.log('📝 Selected prompt type: MIXED/PROJECT-ONLY RESPONSE');
        prompt = `You are an AI assistant for the Samsung PRISM program with access to project and document information.

Available Information:
${context}

User's Question: ${query}

Response Guidelines:
- Synthesize information from all available sources above
- Present key facts clearly and concisely
- Organize information logically using only provided data
- Use direct, professional language
- Include specific details (IDs, names, status) from the context
- Keep sentences short and informative
- Do NOT invent information, scenarios, or examples
- Do NOT create hypothetical situations or fictional characters
- If information is incomplete, state clearly what is available
- Maintain a helpful tone without excessive friendliness

Your Response:`;
      }
    } else {
      console.log('📝 Selected prompt type: NO CONTENT - GENERAL RESPONSE');
      prompt = `You are an AI assistant for Samsung PRISM.

User asked: ${query}

YOU MUST respond with EXACTLY this and NOTHING else:
"I don't have specific information about [their topic]. I can help with Samsung PRISM program details, worklet information, or project guidance. What would you like to know?"

Replace [their topic] with what they asked about (1-3 words maximum).

DO NOT:
- Write more than 2 sentences
- Invent rules, constraints, or limitations
- Create scenarios, examples, or lists
- Discuss how you were programmed
- Make numbered points
- Use phrases like "The assistant can/has/is"

Write ONLY the response template above with [their topic] replaced.

Your Response:`;
    }

    console.log('🚀 Sending request to Ollama...');
    console.log('📋 Context preview:', context.substring(0, 500));
    console.log('💬 Prompt preview:', prompt.substring(0, 300));

    // Use stricter parameters when no content is available to prevent hallucinations
    const hasNoContent = !hasContent;
    const modelOptions = hasNoContent ? {
      temperature: 0.05,    // EXTREMELY low - almost deterministic
      top_p: 0.3,          // Very restricted vocabulary
      top_k: 10,           // Only consider top 10 tokens
      repeat_penalty: 1.5, // Heavy penalty for repetition
      num_ctx: 512,        // Very small context window
      stop: ['\n\n', '\nQuestion:', '\nUser:', 'Context:', 'Instructions:', 'Response Guidelines:', 'CRITICAL INSTRUCTIONS:', '\nConsider', '\nImagine', 'scenario', 'hypothetical', 'rules:', 'programmed', '1.', '2.', 'The assistant', '\nUser:', 'User:', 'Assistant:'],
      num_predict: 50      // Very short - max 50 tokens
    } : {
      temperature: 0.4,     // Low for precise, factual responses
      top_p: 0.85,          
      repeat_penalty: 1.2,
      num_ctx: 1024,       // Reduced for 8GB RAM - smaller context
      stop: ['\n\nQuestion:', '\n\nUser:', 'User:', 'Assistant:', 'Exercises:', '\n\n1.', '\n\n2.', 'Answer:'],
      num_predict: 180     // Reduced for shorter, precise answers
    };

    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'phi',
      prompt,
      stream: false,
      options: modelOptions
    }, {
      timeout: 60000
    });

    if (!response.data || !response.data.response) {
      throw new Error('Invalid response format from Ollama');
    }

    const generatedResponse = response.data.response.trim();
    console.log('✅ Response received from Ollama');
    console.log('📝 Response preview:', generatedResponse.substring(0, 200));

    // Detect and block hallucination patterns when no content was provided
    if (hasNoContent) {
      const hallucinationPatterns = [
        /imagine.*scenario/i,
        /consider.*scenario/i,
        /let'?s.*consider/i,
        /for example.*three.*people/i,
        /version.*A.*B.*C/i,
        /Anna.*Ben.*Carl/i,
        /fictional/i,
        /hypothetical.*where/i,
        /let me.*story/i,
        /programmed with.*rules/i,
        /set of rules/i,
        /constraints for answering/i,
        /assistant can only/i,
        /assistant has been/i,
        /following rules/i,
        /these rules/i,
        /rule number/i,
        /\d+\.\s+The assistant/i,
        /Here are some/i,
        /list of.*rules/i
      ];
      
      const containsHallucination = hallucinationPatterns.some(pattern => pattern.test(generatedResponse));
      
      if (containsHallucination || generatedResponse.length > 150) {
        console.warn('⚠️ Hallucination detected in response - using fallback');
        return "I don't have specific information about that. I can help you with Samsung PRISM program details, worklet information, or project guidance. What would you like to know?";
      }
    }
    
    // ALWAYS check for hallucination patterns even with content
    const globalHallucinationPatterns = [
      /User:.*Assistant:/i,
      /Consider.*following scenario/i,
      /following scenario based on/i,
      /project management system where/i,
      /ID number corresponds/i,
      /system has been programmed/i,
      /\d+\.\s+Dr\.\s+\w+\s+\w+\s+-\s+.*\(ID\s+\d+\)/i, // Fake numbered mentor lists
      /mentor'?s ID number/i,
      /specific area of expertise:/i,
      /if a request is made about worklet ID/i
    ];
    
    const hasGlobalHallucination = globalHallucinationPatterns.some(pattern => pattern.test(generatedResponse));
    
    if (hasGlobalHallucination) {
      console.warn('⚠️ CRITICAL: Global hallucination pattern detected - blocking response');
      // Return only the first sentence if it contains actual data
      const sentences = generatedResponse.split(/[.!?]\s+/);
      if (sentences.length > 0 && sentences[0].length < 200 && !globalHallucinationPatterns.some(p => p.test(sentences[0]))) {
        return sentences[0] + '.';
      }
      return "I can provide information about that worklet. Please ask a specific question about what you'd like to know.";
    }

    return generatedResponse;
  } catch (error) {
    console.error('❌ Error generating response:', error);

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('Failed to fetch')) {
        return "I'm having trouble connecting to the AI service right now. The Ollama service may not be running. You can still ask questions, but responses will be limited.";
      }
    }

    return "Sorry, I encountered an error processing your question. Could you try rephrasing or ask something else?";
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

    // Detect if query is a simple greeting or farewell (short queries without specific questions)
    const isShortQuery = query.trim().split(/\s+/).length <= 3;
    const lowerQuery = query.toLowerCase().trim();
    const greetingKeywords = ['hi', 'hello', 'hey', 'namaste', 'hola', 'bonjour', 'morning', 'evening', 'afternoon'];
    const farewellKeywords = ['bye', 'goodbye', 'night', 'thanks', 'thank'];
    
    const seemsLikeGreeting = isShortQuery && greetingKeywords.some(word => lowerQuery.includes(word));
    const seemsLikeFarewell = isShortQuery && farewellKeywords.some(word => lowerQuery.includes(word));
    
    if (seemsLikeGreeting) {
      console.log('👋 Detected likely greeting');
      const userName = user.name ? user.name.split(' ')[0] : '';
      const greeting = userName ? `Hello, ${userName}!` : 'Hello!';
      
      const introResponses = [
        `${greeting} I'm your Samsung PRISM assistant. I can help you with program information, worklet details, and project guidance. What would you like to know?`,
        `${greeting} I'm the Samsung PRISM AI assistant. Ask me about program details, your worklet, or any project questions. How can I help?`,
        `${greeting} I'm here to assist with Samsung PRISM. I can answer questions about the program, worklets, and projects. What do you need?`
      ];
      
      const greetingAnswer = introResponses[Math.floor(Math.random() * introResponses.length)];
      
      // Store greeting in memory
      addToMemory(userId, query, greetingAnswer);
      
      return {
        answer: greetingAnswer,
        sources: [],
        query
      };
    }
    
    if (seemsLikeFarewell) {
      console.log('👋 Detected likely farewell');
      const farewellResponses = [
        "Goodbye! Feel free to return anytime.",
        "Take care! Happy to help whenever you need.",
        "See you later! Good luck with your project.",
        "Bye! Don't hesitate to ask if you need anything."
      ];
      
      const farewellAnswer = farewellResponses[Math.floor(Math.random() * farewellResponses.length)];
      
      // Store farewell in memory
      addToMemory(userId, query, farewellAnswer);
      
      return {
        answer: farewellAnswer,
        sources: [],
        query
      };
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
    
    // Get conversation history for this user
    const conversationHistory = getConversationContext(userId);
    
    const answer = await generateResponse(
      query, 
      relevantDocs, 
      projectResults, 
      userContext, 
      queryClassification,
      conversationHistory
    );

    // Store this interaction in memory
    addToMemory(userId, query, answer);

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

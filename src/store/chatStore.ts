import { create } from 'zustand';
import { Message, Document } from '../types';
import { createSystemMessage } from '../utils/chatUtils';
import { chatAPI } from '../services/api';

interface ChatState {
  messages: Message[];
  loading: boolean;
  relevantDocuments: Document[];
  error: string | null;
  addMessage: (message: Message) => void;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    createSystemMessage("Hello! I'm the Samsung PRISM AI Assistant. I can help you with information about the PRISM program, mentorship, project submissions, and technical questions.")
  ],
  loading: false,
  relevantDocuments: [],
  error: null,
  
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message]
    }));
  },
  
  sendMessage: async (content) => {
    if (!content.trim()) return;
    
    // Create a user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date()
    };
    
    // Add user message to chat
    get().addMessage(userMessage);
    
    // Set loading state
    set({ loading: true, error: null });
    
    try {
      // Generate response using RAG API
      const response = await chatAPI.generateResponse({ query: content, limit: 5 });
      const { answer, sources } = response.data.data;
      
      // Store relevant documents from sources
      const relevantDocs: Document[] = sources.map((source: any, index: number) => ({
        id: index.toString(),
        title: source.fileName,
        content: source.content,
        metadata: {
          source: source.fileName,
          fileName: source.fileName,
          tags: ['rag-source']
        }
      }));
      
      set({ relevantDocuments: relevantDocs });
      
      // Create assistant message
      const assistantMessage: Message = {
        id: Date.now().toString(),
        content: answer,
        role: 'assistant',
        timestamp: new Date()
      };
      
      // Add assistant message to chat
      get().addMessage(assistantMessage);
    } catch (error: any) {
      console.error('Error generating response:', error);
      
      // Set error message
      set({
        error: error.response?.data?.error || 'Failed to generate response. Please try again.'
      });
      
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "I'm sorry, but I encountered an error while processing your request. Please try again later.",
        role: 'assistant',
        timestamp: new Date()
      };
      
      get().addMessage(errorMessage);
    } finally {
      // Set loading state to false
      set({ loading: false });
    }
  },
  
  clearChat: () => {
    set({
      messages: [
        createSystemMessage("Hello! I'm the Samsung PRISM AI Assistant. I can help you with information about the PRISM program, mentorship, project submissions, and technical questions.")
      ],
      relevantDocuments: [],
      error: null
    });
  },
  
  setLoading: (isLoading) => {
    set({ loading: isLoading });
  },
  
  setError: (error) => {
    set({ error });
  }
}));
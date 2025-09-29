import { Message, FileAttachment } from '../types';

// Generate a unique ID for messages
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Format date for message display
export const formatMessageTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Simple delay function to simulate AI thinking time
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Extract main topics from a message for improved retrieval
export const extractTopics = (message: string): string[] => {
  // This is a simplified implementation
  // In a real application, you would use NLP techniques
  const words = message.toLowerCase().split(/\s+/);
  const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with']);
  return words
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5);
};

// Create a system message
export const createSystemMessage = (content: string): Message => {
  return {
    id: generateId(),
    content,
    role: 'system',
    timestamp: new Date()
  };
};

// Create a user message
export const createUserMessage = (content: string, attachments?: FileAttachment[]): Message => {
  return {
    id: generateId(),
    content,
    role: 'user',
    timestamp: new Date(),
    attachments
  };
};

// Create an assistant message
export const createAssistantMessage = (content: string): Message => {
  return {
    id: generateId(),
    content,
    role: 'assistant',
    timestamp: new Date()
  };
};
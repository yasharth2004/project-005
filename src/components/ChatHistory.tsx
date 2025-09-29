import React, { useRef, useEffect } from 'react';
import { Message } from '../types';
import ChatMessage from './ChatMessage';
import './ChatHistory.css';

interface ChatHistoryProps {
  messages: Message[];
  loading?: boolean;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ messages, loading = false }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="chat-history">
      {messages.length === 0 ? (
        <div className="empty-chat">
          <div className="empty-chat-content">
            <h2>Welcome to Samsung PRISM AI Assistant</h2>
            <p>
              I'm here to help you with information about the Samsung PRISM program, 
              mentorship, project submissions, and technical questions.
            </p>
            <p>How can I assist you today?</p>
          </div>
        </div>
      ) : (
        messages.map((message, index) => (
          <ChatMessage 
            key={message.id} 
            message={message} 
            isLastMessage={index === messages.length - 1}
          />
        ))
      )}
      
      {loading && (
        <div className="typing-indicator">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatHistory;
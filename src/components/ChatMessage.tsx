import React from 'react';
import { Message } from '../types';
import { formatMessageTime } from '../utils/chatUtils';
import { User, FileText, Image, File } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './ChatMessage.css';

interface ChatMessageProps {
  message: Message;
  isLastMessage: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLastMessage }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image size={14} />;
    if (fileType === 'application/pdf') return <FileText size={14} />;
    if (fileType.includes('word')) return <FileText size={14} />;
    return <File size={14} />;
  };

  return (
    <div 
      className={`chat-message ${isLastMessage ? 'slide-up' : ''}`}
      data-testid="chat-message"
    >
      <div className={`chat-message-container ${isUser ? 'user' : isSystem ? 'system' : 'assistant'}`}>
        {!isUser && !isSystem && (
          <div className="avatar assistant">
            <div className="avatar-inner">
              <span className="avatar-text">AI</span>
            </div>
          </div>
        )}
        
        {isUser && (
          <div className="avatar user">
            <div className="avatar-inner">
              <User size={18} />
            </div>
          </div>
        )}
        
        <div className="message-content">
          <div className="message-bubble">
            <ReactMarkdown className="markdown-content">
              {message.content}
            </ReactMarkdown>
            
            {message.attachments && message.attachments.length > 0 && (
              <div className="message-attachments">
                {message.attachments.map((attachment) => (
                  <div key={attachment.id} className="attachment-preview">
                    {getFileIcon(attachment.type)}
                    <span>{attachment.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="message-time">
            {formatMessageTime(message.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
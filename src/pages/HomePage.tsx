import React from 'react';
import AppLayout from '../components/AppLayout';
import ChatInterface from '../components/ChatInterface';
import DocumentViewer from '../components/DocumentViewer';
import { useChatStore } from '../store/chatStore';
import './HomePage.css';

const HomePage: React.FC = () => {
  const { relevantDocuments } = useChatStore();

  return (
    <AppLayout>
      <div className="home-page">
        <div className="chat-section">
          <ChatInterface />
        </div>
        
        <div className="documents-section">
          <DocumentViewer documents={relevantDocuments} />
        </div>
      </div>
    </AppLayout>
  );
};

export default HomePage;
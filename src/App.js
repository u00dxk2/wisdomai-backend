import React, { useState } from 'react';
import Chat from './components/Chat';
import WisdomSelector from './components/WisdomSelector';
import ChatHistory from './components/ChatHistory';
import './App.css';

function App() {
  const [selectedFigure, setSelectedFigure] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // When a chat is updated (new message added)
  const handleChatUpdated = (chatId) => {
    console.log('Chat updated with ID:', chatId, 'Current activeChatId:', activeChatId, 'Current selectedChatId:', selectedChatId);
    
    // If chatId is null, this is a "new chat" or "clear chat" action
    if (!chatId) {
      console.log('No chatId provided - creating new chat or clearing current chat');
      
      // Important: Clear both selectedChatId and activeChatId
      // This ensures next message will create a new chat
      setSelectedChatId(null);
      setActiveChatId(null);
      
      // Trigger a refresh to update chat history
      setRefreshTrigger(prev => prev + 1);
      return;
    }
    
    // Always update selectedChatId to the current chat
    // This ensures we stay in the same chat after sending a message
    if (selectedChatId !== chatId) {
      console.log('Updating selectedChatId to:', chatId);
      setSelectedChatId(chatId);
    }
    
    // Always update activeChatId
    if (activeChatId !== chatId) {
      console.log('Updating activeChatId to:', chatId);
      setActiveChatId(chatId);
    }
    
    // Always trigger a refresh to update chat history
    // This ensures new/updated chats appear immediately
    console.log('Triggering history refresh');
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="App">
      <div className="sidebar">
        <WisdomSelector
          selectedFigure={selectedFigure}
          onSelectFigure={setSelectedFigure}
        />
        <ChatHistory
          activeChatId={activeChatId}
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <div className="main-content">
        <Chat
          selectedFigure={selectedFigure}
          selectedChatId={selectedChatId}
          onChatUpdated={handleChatUpdated}
        />
      </div>
    </div>
  );
}

export default App; 
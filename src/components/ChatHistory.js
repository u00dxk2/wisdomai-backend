import React, { useEffect, useCallback } from 'react';
import { getChatHistory } from '../services/chatService';
import './ChatHistory.css';

function ChatHistory({ activeChatId, selectedChatId, onSelectChat, refreshTrigger }) {
  const [chats, setChats] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Function to load chat history
  const loadChatHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const history = await getChatHistory();
      setChats(history);
    } catch (err) {
      console.error('Error loading chat history:', err);
      setError('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load chat history when component mounts or refreshTrigger changes
  useEffect(() => {
    console.log('ChatHistory refreshTrigger changed:', refreshTrigger);
    console.log('Current activeChatId:', activeChatId, 'selectedChatId:', selectedChatId);
    
    // Always load history when refresh is triggered
    // This makes sure we see new/updated chats immediately
    console.log('Refreshing chat history from trigger');
    loadChatHistory();
  }, [refreshTrigger, loadChatHistory]);

  const handleChatClick = (chatId) => {
    console.log('Chat clicked:', chatId);
    onSelectChat(chatId);
  };

  if (loading) {
    return <div className="chat-history loading">Loading...</div>;
  }

  if (error) {
    return <div className="chat-history error">{error}</div>;
  }

  return (
    <div className="chat-history">
      <h2>Chat History</h2>
      <div className="chat-list">
        {chats.map((chat) => (
          <div
            key={chat._id}
            className={`chat-item ${chat._id === selectedChatId ? 'selected' : ''}`}
            onClick={() => handleChatClick(chat._id)}
          >
            <div className="chat-preview">
              {chat.preview || 'New chat'}
            </div>
            <div className="chat-meta">
              {new Date(chat.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatHistory; 
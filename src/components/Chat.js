import WisdomSelector from './WisdomSelector';
import UserMemoryDisplay from './UserMemoryDisplay';
import { getChatMessages, sendMessage, clearChat, saveMessage } from '../services/chatService';

const Chat = ({ selectedFigure, setFigure, onChatUpdated, selectedChatId }) => {
  // ... existing code ...
      // --- Refactored stream handling --- 
      // Call sendMessage (which now handles streaming setup)
      const { eventSource, cleanup } = sendMessage(currentChatId, userMessage.content, selectedFigure);
      
      // Store the cleanup function
// ... existing code ...
} 
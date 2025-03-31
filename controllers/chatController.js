const ChatHistory = require('../models/ChatHistory');

/**
 * Create a new chat or add a message to existing chat
 * @route POST /api/chat/message
 */
exports.saveMessage = async (req, res) => {
  try {
    const { chatId, message, wisdomFigure } = req.body;
    
    // Ensure we have a valid user ID
    if (!req.user || !req.user.id) {
      console.error('No user ID found in request:', req.user);
      return res.status(401).json({ message: 'Unauthorized - No user ID found' });
    }
    
    const userId = req.user.id;
    console.log('Processing message save:', { userId, chatId, messageRole: message.role, wisdomFigure });

    let chat;
    if (chatId) {
      // Add message to existing chat
      chat = await ChatHistory.findOne({ _id: chatId, user: userId });
      if (!chat) {
        console.error(`Chat not found for ID ${chatId} and user ${userId}`);
        return res.status(404).json({ message: 'Chat not found' });
      }
      
      // If it's an assistant message, ensure it has the wisdom figure
      if (message.role === 'assistant') {
        message.figure = wisdomFigure;
      }
      
      chat.messages.push(message);
      chat.lastMessage = message.content;
    } else {
      // Create new chat with initial title from user message
      const initialTitle = message.role === 'user' && message.content 
        ? (message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content)
        : 'New Chat';

      chat = new ChatHistory({
        user: userId,
        title: initialTitle,
        messages: [message],
        lastMessage: message.content
      });
    }

    const savedChat = await chat.save();
    console.log('Chat saved successfully:', { 
      chatId: savedChat._id, 
      messageCount: savedChat.messages.length,
      title: savedChat.title
    });
    res.json(savedChat);
  } catch (error) {
    console.error('Error saving message:', error);
    // Send more detailed error information
    res.status(500).json({ 
      message: 'Error saving message',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get all chats for a user
 * @route GET /api/chat/history
 */
exports.getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = await ChatHistory.find({ user: userId })
      .sort({ updatedAt: -1 })
      .select('title messages lastMessage createdAt updatedAt');
    
    // Format the response to include relevant information
    const formattedChats = chats.map(chat => ({
      _id: chat._id,
      title: chat.title,
      lastMessage: chat.lastMessage,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      // Get the last assistant message's figure, if any
      lastFigure: chat.messages
        .filter(msg => msg.role === 'assistant')
        .slice(-1)[0]?.figure
    }));
    
    res.json(formattedChats);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ message: 'Error fetching chat history' });
  }
};

/**
 * Get messages for a specific chat
 * @route GET /api/chat/:chatId
 */
exports.getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await ChatHistory.findOne({ _id: chatId, user: userId });
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ message: 'Error fetching chat messages' });
  }
};

/**
 * Delete a chat
 * @route DELETE /api/chat/:chatId
 */
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const result = await ChatHistory.deleteOne({ _id: chatId, user: userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ message: 'Error deleting chat' });
  }
};

/**
 * Clear the current chat (remove all messages but keep the chat)
 * @route POST /api/chat/clear
 */
exports.clearChat = async (req, res) => {
  try {
    const { chatId } = req.body;
    const userId = req.user.id;

    // Validate required parameters
    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    // Find the chat
    const chat = await ChatHistory.findOne({ _id: chatId, user: userId });
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Clear the messages array but keep the chat
    chat.messages = [];
    chat.lastMessage = '';
    await chat.save();

    console.log(`Chat ${chatId} cleared successfully for user ${userId}`);
    res.json({ message: 'Chat cleared successfully' });
  } catch (error) {
    console.error('Error clearing chat:', error);
    res.status(500).json({ message: 'Error clearing chat' });
  }
}; 
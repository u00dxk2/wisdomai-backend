const ChatHistory = require('../models/ChatHistory');

/**
 * Create a new chat or add a message to existing chat
 * @route POST /api/chat/message
 */
exports.saveMessage = async (req, res) => {
  try {
    const { chatId, message } = req.body;
    const userId = req.user.id;

    let chat;
    if (chatId) {
      // Add message to existing chat
      chat = await ChatHistory.findOne({ _id: chatId, userId });
      if (!chat) {
        return res.status(404).json({ message: 'Chat not found' });
      }
      chat.messages.push(message);
    } else {
      // Create new chat
      chat = new ChatHistory({
        userId,
        messages: [message],
        title: message.content.substring(0, 50) + '...' // Use first message as title
      });
    }

    await chat.save();
    res.json(chat);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ message: 'Error saving message' });
  }
};

/**
 * Get all chats for a user
 * @route GET /api/chat/history
 */
exports.getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = await ChatHistory.find({ userId })
      .sort({ lastUpdated: -1 })
      .select('title lastUpdated summary');
    res.json(chats);
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

    const chat = await ChatHistory.findOne({ _id: chatId, userId });
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

    const result = await ChatHistory.deleteOne({ _id: chatId, userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ message: 'Error deleting chat' });
  }
}; 
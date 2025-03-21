import api from './api';

/**
 * Save a message to chat history
 * @param {string} chatId - Optional chat ID for existing chat
 * @param {Object} message - Message object with role and content
 * @returns {Promise} Chat object with messages
 */
export const saveMessage = async (chatId, message) => {
  const response = await api.post('/api/chat/message', { chatId, message });
  return response.data;
};

/**
 * Get user's chat history
 * @returns {Promise} Array of chat objects
 */
export const getChatHistory = async () => {
  const response = await api.get('/api/chat/history');
  return response.data;
};

/**
 * Get messages for a specific chat
 * @param {string} chatId - Chat ID
 * @returns {Promise} Chat object with messages
 */
export const getChatMessages = async (chatId) => {
  const response = await api.get(`/api/chat/${chatId}`);
  return response.data;
};

/**
 * Delete a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise} Success message
 */
export const deleteChat = async (chatId) => {
  const response = await api.delete(`/api/chat/${chatId}`);
  return response.data;
}; 
import api from './api';
import { getAuthToken } from '../utils/auth';

/**
 * Save a message to chat history
 * @param {string} chatId - Optional chat ID for existing chat
 * @param {Object} message - Message object with role and content
 * @returns {Promise} Chat object with messages
 */
export const saveMessage = async (chatId, message) => {
  try {
    const response = await api.post('/api/chat/message', { chatId, message });
    return response.data;
  } catch (error) {
    console.error('Error saving message:', error);
    throw new Error(error.response?.data?.message || 'Failed to save message');
  }
};

/**
 * Get user's chat history
 * @returns {Promise} Array of chat objects
 */
export const getChatHistory = async () => {
  try {
    const response = await api.get('/api/chat/history');
    return response.data;
  } catch (error) {
    console.error('Error getting chat history:', error);
    throw new Error(error.response?.data?.message || 'Failed to load chat history');
  }
};

/**
 * Get messages for a specific chat
 * @param {string} chatId - Chat ID
 * @returns {Promise} Chat object with messages
 */
export const getChatMessages = async (chatId) => {
  try {
    const response = await api.get(`/api/chat/${chatId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting chat messages:', error);
    throw new Error(error.response?.data?.message || 'Failed to load chat messages');
  }
};

/**
 * Delete a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise} Success message
 */
export const deleteChat = async (chatId) => {
  try {
    const response = await api.delete(`/api/chat/${chatId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting chat:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete chat');
  }
};

/**
 * Stream a chat response from a selected wisdom figure
 * @param {string} message - User's message/question
 * @param {string} wisdomFigure - Selected wisdom figure
 * @returns {Promise} Response stream
 */
export const streamChat = async (message, wisdomFigure) => {
  return new Promise((resolve, reject) => {
    try {
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const token = getAuthToken();
      const eventSourceUrl = new URL(`${baseUrl}/api/chat-stream`);
      eventSourceUrl.searchParams.append('message', message);
      eventSourceUrl.searchParams.append('wisdomFigure', wisdomFigure);
      eventSourceUrl.searchParams.append('token', token);

      const eventSource = new EventSource(eventSourceUrl);
      let fullResponse = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.content) {
            fullResponse += data.content;
            // Emit progress
            if (typeof eventSource.onProgress === 'function') {
              eventSource.onProgress(fullResponse);
            }
          }
          if (data.done) {
            eventSource.close();
            resolve(fullResponse);
          }
        } catch (error) {
          console.error('Error parsing event data:', error);
          eventSource.close();
          reject(new Error('Failed to parse response data'));
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource failed:', error);
        eventSource.close();
        reject(new Error('Failed to establish connection with server'));
      };
    } catch (error) {
      console.error('Error setting up EventSource:', error);
      reject(error);
    }
  });
}; 
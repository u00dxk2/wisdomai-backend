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
 * Sets up an EventSource connection to stream chat responses.
 * @param {string | null} chatId - Optional ID of the current chat thread.
 * @param {string} message - User's message/question.
 * @param {string} wisdomFigure - Selected wisdom figure.
 * @returns {{ eventSource: EventSource, cleanup: () => void }} - Returns the EventSource instance and a cleanup function.
 * @throws {Error} If setup fails.
 */
export const sendMessage = (chatId, message, wisdomFigure) => {
  try {
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
    const token = getAuthToken();
    const eventSourceUrl = new URL(`${baseUrl}/api/chat-stream`);
    eventSourceUrl.searchParams.append('message', message);
    eventSourceUrl.searchParams.append('wisdomFigure', wisdomFigure);
    if (chatId) {
      eventSourceUrl.searchParams.append('chatId', chatId);
    }
    eventSourceUrl.searchParams.append('token', token); // Auth token

    const eventSource = new EventSource(eventSourceUrl);

    const cleanup = () => {
      if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        console.log('Closing EventSource connection.');
        eventSource.close();
      }
    };

    // Return the eventSource and cleanup function immediately
    return { eventSource, cleanup };

  } catch (error) {
    console.error('Error setting up EventSource:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}; 
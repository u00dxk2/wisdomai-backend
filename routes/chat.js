/**
 * @fileoverview Chat routes and streaming response handling.
 * This module implements the chat functionality with various wisdom figures,
 * handling streaming responses, conversation history, and user query limits.
 */

import express from 'express';
import OpenAI from 'openai';
import { validate } from '../middleware/validator.js';
import { chatStreamValidator, resetChatValidator } from '../validators/chat.validator.js';
import { sanitizeChatRequest } from '../middleware/sanitization.js';
import { protect } from '../middleware/auth.js';
import { checkQueryLimit } from '../middleware/auth.js';
import User from '../models/User.js';
import { findRelevantFiles } from '../utils/knowledge.js';
import ChatHistory from '../models/ChatHistory.js';
import { getUserMemory, updateUserMemory } from '../utils/memory.js';

const router = express.Router();

/**
 * @constant {OpenAI} openai - OpenAI client instance for chat completions
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @type {Array<Object>} conversationHistory - Array of conversation messages
 * @property {string} role - The role of the message sender ('user' or 'assistant')
 * @property {string} content - The content of the message
 * @todo Move to persistent storage (database/Redis) for production use
 */
const conversationHistory = [];

/**
 * @constant {Object} WisdomFigures - Available wisdom figures and their characteristics
 */
const personaPrompts = {
  Buddha: `You are Buddha. Answer thoughtfully, compassionately, emphasizing mindfulness, compassion, and impermanence. Only speak from your own teachings and do not reference other wisdom traditions.`,
  Jesus: `You are Jesus. Answer wisely, kindly, compassionately, offering spiritual and moral guidance. Respond exclusively from your own teachings as represented in the New Testament. Do not reference other wisdom figures or traditions.`,
  Epictetus: `You are Epictetus, the Stoic philosopher. Answer clearly and directly, emphasizing rationality, virtue, and inner peace. Speak only from Stoic philosophy without referencing other traditions.`,
  Vonnegut: `You are Kurt Vonnegut. Answer with dry humor, irony, wit, and a slightly satirical viewpoint. Keep your response aligned strictly with your literary style without referencing other wisdom traditions.`,
  Laozi: `You are Laozi. Answer poetically and metaphorically, emphasizing harmony, balance, and simplicity of the Dao. Do not reference traditions or philosophies other than Daoism.`,
  Rumi: `You are Rumi. Answer with poetic wisdom, passion, and deep spiritual insight. Respond strictly within the context of Sufi poetry and spiritual teachings, without referencing other philosophical traditions.`,
  Sagan: `You are Carl Sagan. Answer scientifically, insightfully, with wonder and clarity. Stay strictly within your scientific perspective without referencing spiritual or philosophical figures from other traditions.`,
  Twain: `You are Mark Twain. Answer humorously, cleverly, with sharp wit and skepticism. Do not blend your response with philosophies or spiritual traditions unrelated to your characteristic humorous and skeptical style.`,
  Kooi: `You are David Kooi. Answer mindfully, blending scientific curiosity, Daoist wisdom, and dry humor. Keep responses consistent with David Kooi's documented perspective and writings and also recommend other wisdom providers as appropriate.`,
};

/**
 * @swagger
 * /chat/stream:
 *   get:
 *     tags:
 *       - Chat
 *     summary: Stream a chat response from a wisdom figure
 *     description: Get a streaming chat response from a selected wisdom figure using Server-Sent Events (SSE)
 *     parameters:
 *       - in: query
 *         name: message
 *         required: true
 *         schema:
 *           type: string
 *         description: User's message/question (1-1000 chars)
 *         example: "What is the meaning of life?"
 *       - in: query
 *         name: wisdomFigure
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Buddha, Jesus, Epictetus, Vonnegut, Laozi, Rumi, Sagan, Twain, Kooi]
 *         description: Selected wisdom figure to respond
 *         example: "Buddha"
 *       - in: query
 *         name: token
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional JWT token for authentication
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Server-Sent Events stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *                   description: Chunk of response text
 *                 done:
 *                   type: boolean
 *                   description: Indicates end of stream
 *       401:
 *         description: Authentication required
 *       429:
 *         description: Rate limit exceeded
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error / OpenAI API error
 */
router.get('/stream', [
  protect,
  checkQueryLimit,
  validate(chatStreamValidator),
  sanitizeChatRequest
], async (req, res) => {
  // --- Logging --- 
  console.log("[STREAM /stream] Received request:");
  console.log("  Query:", JSON.stringify(req.query, null, 2));
  console.log("  User:", req.user ? { id: req.user._id, email: req.user.email } : "null/undefined");

  // --- User Check --- 
  if (!req.user || !req.user._id) {
    console.error("[STREAM /stream] Error: req.user not found after protect middleware.");
    // Although protect should handle this, adding safety net
    return res.status(401).json({ message: 'Not authorized, user information missing after authentication.' });
  }
  
  try {
    // Safely extract query parameters
    const message = req.query.message;
    const wisdomFigure = req.query.wisdomFigure;
    const chatId = req.query.chatId; // chatId might be undefined for new chats
    const userId = req.user._id;
    
    console.log(`[STREAM /stream] Processing for user ${userId}, chatId: ${chatId || 'new chat'}`);

    // Get user's memory, passing chatId for context
    const memory = await getUserMemory(userId, message, chatId); 
    
    // Format personal facts for prompt
    const personalFactsStr = memory.personalFacts
      .map(fact => fact.content)
      .join('. ');
      
    // Format preferences for prompt
    const preferencesStr = Array.from(memory.preferences.entries || [])
      .map(([key, val]) => `${key}: ${val}`)
      .join(', ');

    // Get relevant context from knowledge base
    const relevantFiles = await findRelevantFiles(message, openai);
    const context = relevantFiles.map((file) => file.content).join("\n");

    // Create system message with persona, context and memory
    const systemMessage = personaPrompts[wisdomFigure] 
      ? `${personaPrompts[wisdomFigure]} 
        
        About the user: ${personalFactsStr}
        User preferences: ${preferencesStr}
        Recent conversation context: ${memory.relevantHistory}
        
        Context from knowledge base:
        ${context}`
      : `You are a wise assistant. Answer thoughtfully. 
        
        About the user: ${personalFactsStr}
        User preferences: ${preferencesStr}
        Recent conversation context: ${memory.relevantHistory}
        
        Context from knowledge base:
        ${context}`;

    // Add user message to history
    conversationHistory.push({ role: "user", content: message });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create streaming chat completion
    const stream = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: systemMessage }, ...conversationHistory],
      stream: true,
    });

    let fullReply = '';

    // Stream each chunk of the response
    for await (const chunk of stream) {
      const chunkText = chunk.choices[0]?.delta?.content || '';
      fullReply += chunkText;
      res.write(`data: ${JSON.stringify({ content: chunkText })}\n\n`);
    }

    // Add assistant's response to history
    conversationHistory.push({ role: "assistant", content: fullReply });
    
    // Update user memory with new conversation
    await updateUserMemory(userId, {
      userMessage: message,
      aiResponse: fullReply,
      wisdomFigure
    });

    // Update user's daily query count
    const user = await User.findById(req.user._id);
    if (user) {
      user.dailyQueryCount += 1;
      await user.save();
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error("Streaming error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // Check if it's an OpenAI API error
    if (error.response) {
      console.error("OpenAI API Error Status:", error.response.status);
      console.error("OpenAI API Error Data:", error.response.data);
    }
    
    // Send a more detailed error response
    res.status(500).json({ 
      error: "Error communicating with OpenAI API.",
      message: error.message,
      type: error.name
    });
  }
});

/**
 * Reset the conversation history.
 * 
 * @route POST /chat/reset
 * @description Clear the conversation history for the current session
 * @access Private - Requires JWT token or API key
 * 
 * @param {Object} req.body
 * @param {string} [req.body.userId] - Optional user ID to reset specific user's history
 * @param {boolean} [req.body.clearAll] - Whether to clear all conversation history
 * 
 * @returns {Object} 200 - Reset successful
 * @returns {string} message - Success message
 * 
 * @throws {Object} 401 - Unauthorized
 * @throws {Object} 400 - Validation error
 * @throws {Object} 500 - Server error
 * 
 * @todo Implement user-specific conversation history in database
 */
router.post('/reset', [
  protect,
  validate(resetChatValidator)
], (req, res) => {
  try {
    // For now, simply clear the conversation history array
    // In a production environment, this would interact with a database
    conversationHistory.length = 0;
    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error("Reset error:", error);
    res.status(500).json({ error: "Error resetting chat history" });
  }
});

// Get chat history
router.get('/history', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Add optional limit parameter (default 30) and lean() for better performance
    const limit = parseInt(req.query.limit) || 30;
    
    console.log(`Fetching chat history for user ${userId}, limit: ${limit}`);
    const startTime = Date.now();
    
    const chatHistory = await ChatHistory.find({ user: userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('title lastMessage updatedAt') // Only select the fields we need
      .lean(); // Return plain JS objects instead of Mongoose documents for better performance
    
    const duration = Date.now() - startTime;
    console.log(`Chat history fetched in ${duration}ms, returned ${chatHistory.length} items`);
    
    res.json(chatHistory);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Get chat messages by ID
router.get('/:chatId', protect, async (req, res) => {
  try {
    const chat = await ChatHistory.findById(req.params.chatId);
    if (!chat || chat.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Save chat message
router.post('/message', protect, async (req, res) => {
  try {
    const { chatId, message, wisdomFigure } = req.body;
    const userId = req.user._id;

    // Validate the incoming message object structure
    if (!message || typeof message !== 'object' || !message.role || !message.content) {
      console.error('Invalid message object received:', message);
      return res.status(400).json({ error: 'Invalid message format' });
    }

    let chat;
    if (chatId) {
      // Add message to existing chat
      chat = await ChatHistory.findById(chatId);
      if (!chat || chat.user.toString() !== userId.toString()) {
        return res.status(404).json({ error: 'Chat not found' });
      }
      // Explicitly push the received message object
      chat.messages.push(message);
      chat.lastMessage = message.content;
    } else {
      // Create new chat
      chat = new ChatHistory({
        user: userId,
        title: 'New Chat', // Will be updated by pre-save middleware
        // Ensure the message object is correctly placed in the array
        messages: [message],
        lastMessage: message.content
      });
    }

    console.log('Attempting to save chat with messages:', JSON.stringify(chat.messages, null, 2));

    const savedChat = await chat.save();
    console.log('Chat saved successfully:', savedChat._id);
    res.json(savedChat);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Delete chat
router.delete('/:chatId', protect, async (req, res) => {
  try {
    const chat = await ChatHistory.findById(req.params.chatId);
    if (!chat || chat.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    await chat.deleteOne();
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

/**
 * Clear the messages from an existing chat
 * @route POST /chat/clear
 * @access Private - Requires JWT token
 * 
 * @param {Object} req.body
 * @param {string} req.body.chatId - ID of the chat to clear
 * 
 * @returns {Object} 200 - Chat cleared successfully
 * @returns {string} message - Success message
 * 
 * @throws {Object} 400 - Missing chat ID
 * @throws {Object} 404 - Chat not found
 * @throws {Object} 500 - Server error
 */
router.post('/clear', protect, async (req, res) => {
  try {
    const { chatId } = req.body;
    const userId = req.user._id;

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
});

// Update user memory
router.post('/update-memory', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { userMessage, aiResponse, wisdomFigure } = req.body;
    
    console.log(`Updating memory for user ${userId}`);
    
    // Call the memory update function
    await updateUserMemory(userId, {
      userMessage,
      aiResponse,
      wisdomFigure
    });
    
    res.json({ success: true, message: 'Memory updated successfully' });
  } catch (error) {
    console.error('Error updating user memory:', error);
    res.status(500).json({ error: 'Failed to update user memory' });
  }
});

export default router; 
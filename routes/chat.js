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
  try {
    const { message, wisdomFigure } = req.query;

    // Get relevant context from knowledge base
    const relevantFiles = await findRelevantFiles(message, openai);
    const context = relevantFiles.map((file) => file.content).join("\n");

    // Create system message with persona and context
    const systemMessage = personaPrompts[wisdomFigure] 
      ? `${personaPrompts[wisdomFigure]} Context:\n${context}`
      : `You are a wise assistant. Answer thoughtfully. Context:\n${context}`;

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
    res.status(500).json({ error: "Error communicating with OpenAI API." });
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
    const chatHistory = await ChatHistory.find({ user: userId })
      .sort({ updatedAt: -1 })
      .select('title lastMessage updatedAt');
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
    
    let chat;
    if (chatId) {
      // Add message to existing chat
      chat = await ChatHistory.findById(chatId);
      if (!chat || chat.user.toString() !== userId.toString()) {
        return res.status(404).json({ error: 'Chat not found' });
      }
      chat.messages.push(message);
      chat.lastMessage = message.content;
    } else {
      // Create new chat
      chat = new ChatHistory({
        user: userId,
        title: 'New Chat', // Will be updated by pre-save middleware
        messages: [message],
        lastMessage: message.content
      });
    }
    
    const savedChat = await chat.save();
    console.log('Chat saved:', {
      id: savedChat._id,
      title: savedChat.title,
      messageCount: savedChat.messages.length
    });
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

export default router; 
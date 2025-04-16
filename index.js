/**
 * @fileoverview Main server application entry point.
 * Sets up Express server with security middleware, routes, and error handling.
 * Implements CORS, rate limiting, and authentication for the WisdomAI API.
 */

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";
import { loadTextFiles } from "./loadTextFiles.js";
import fs from "fs";
import { cosineSimilarity } from "./utils.js";
import rateLimit from "express-rate-limit";
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import apiKeyRoutes from './routes/apiKey.js';
import chatRoutes from './routes/chat.js';
import healthRoutes from './routes/health.js';
import userRoutes from './routes/userRoutes.js';
import { protect, checkQueryLimit } from './middleware/auth.js';
import { authenticateApiKey } from './middleware/apiAuth.js';
import User from './models/User.js';
import helmet from 'helmet';
import { sanitizeChatRequest, preventXSS } from './middleware/sanitization.js';
import { chatStreamValidator, resetChatValidator } from './validators/chat.validator.js';
import { validate } from './middleware/validator.js';
import swaggerUi from 'swagger-ui-express';
import specs from './config/swagger.js';
import ChatHistory from './models/ChatHistory.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

/**
 * @type {express.Application}
 */
const app = express();

/**
 * CORS Configuration
 * Allows requests from specified origins and sets appropriate headers
 * for cross-origin requests.
 * 
 * @type {Object}
 * @property {Function} origin - Origin validation function
 * @property {Array<string>} methods - Allowed HTTP methods
 * @property {Array<string>} allowedHeaders - Allowed request headers
 * @property {boolean} credentials - Allow credentials (cookies, auth headers)
 * @property {number} maxAge - Preflight request cache duration
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',     // Local development
      'http://localhost:5173',     // Vite default
      'https://wisdomai-frontend.vercel.app', // Production frontend
      process.env.FRONTEND_URL,    // Production frontend (from env)
    ].filter(Boolean); // Remove undefined/null values
    
    // Check exact matches first
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }
    
    // Allow all Vercel preview deployments for this project
    // These patterns match both the main deployment and preview URLs from Vercel
    if (origin.match(/https:\/\/wisdomai-frontend[a-zA-Z0-9-]*.vercel.app/) ||
        origin.match(/https:\/\/wisdomai-frontend-[a-zA-Z0-9-]*.vercel.app/)) {
      console.log('CORS: Allowing Vercel preview URL:', origin);
      callback(null, true);
      return;
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200,
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers']
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

/**
 * Helmet Security Configuration
 * Sets various HTTP headers to help protect the application.
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "wss://api.openai.com"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin']
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: true },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
}));

// Apply XSS prevention to all routes
app.use(preventXSS);

// Apply body parsing middleware
app.use(express.json());
app.use(bodyParser.json());

/**
 * Rate Limiting Configuration
 * Prevents abuse by limiting the number of requests per IP address.
 * Separate limits for chat streaming and regular endpoints.
 */

// Regular endpoints rate limiter (more lenient)
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests, please try again later."
  }
});

// Streaming endpoint rate limiter (more strict)
const streamLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Slow down, wise seeker! 🧘‍♂️ You've reached your limit—pause, reflect, and return soon."
  }
});

// Apply rate limiters to specific routes
app.use('/api/chat/stream', streamLimiter);
app.use('/api/chat', standardLimiter);

// Mount route handlers
app.use('/api/auth', authRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/health', healthRoutes);

/**
 * API Documentation
 * Serves Swagger UI for API documentation
 */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "WisdomAI API Documentation"
}));

/**
 * Health Check Endpoint
 * Simple endpoint to verify server status.
 * 
 * @route GET /health
 * @returns {Object} Server status information
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Knowledge base setup
const knowledgeDir = process.env.KNOWLEDGE_DIR || "./knowledge";

let knowledgeBase = [];
try {
  knowledgeBase = loadTextFiles(knowledgeDir);
  console.log(`Loaded files from directory: ${knowledgeDir}`);
} catch (error) {
  console.error("Error loading knowledge base:", error.message);
}

// Load embeddings from JSON
const embeddingsFilePath = "./knowledgeEmbeddings.json";
let knowledgeEmbeddings = [];

try {
  knowledgeEmbeddings = JSON.parse(fs.readFileSync(embeddingsFilePath, "utf-8"));
  console.log(`Loaded ${knowledgeEmbeddings.length} embeddings from ${embeddingsFilePath}`);
} catch (error) {
  console.error("Error loading embeddings:", error.message);
}

// Relevant files finder
const findRelevantFiles = async (query, openai) => {
  const queryEmbeddingResponse = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: query,
  });
  const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

  const similarities = knowledgeEmbeddings.map((item) => ({
    ...item,
    similarity: cosineSimilarity(queryEmbedding, item.embedding),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, 3);
};

// OpenAI Initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @route GET /chat-stream
 * @description Stream a chat response from a selected wisdom figure using Server-Sent Events (SSE)
 * @access Private - Requires JWT token, API key, or query token
 * 
 * @param {Object} req.query
 * @param {string} req.query.message - User's message/question (1-1000 chars)
 * @param {string} req.query.wisdomFigure - Selected wisdom figure (Buddha|Jesus|Epictetus|Vonnegut|Laozi|Rumi|Sagan|Twain|Kooi)
 * @param {string} [req.query.token] - Optional JWT token for authentication
 * 
 * @param {Object} req.headers
 * @param {string} [req.headers.Authorization] - Bearer token for JWT authentication
 * @param {string} [req.headers.X-API-Key] - API key for authentication
 * 
 * @returns {Stream} 200 - Server-Sent Events stream
 * @returns {Object} data - Stream event data
 * @returns {string} data.content - Chunk of response text
 * @returns {boolean} data.done - Indicates end of stream
 * 
 * @throws {Object} 401 - Authentication required
 * @throws {Object} 429 - Rate limit exceeded
 * @throws {Object} 400 - Validation error
 * @throws {Object} 500 - Server error / OpenAI API error
 */
app.get("/chat-stream", [
  protect, 
  checkQueryLimit,
  validate(chatStreamValidator),
  sanitizeChatRequest
], async (req, res) => {
  try {
    // Get userId from authenticated request (set by 'protect' middleware)
    const userId = req.user.id;
    // Get message, wisdomFigure, and optional chatId from query
    const { message, wisdomFigure, chatId } = req.query;

    // --- Fetch existing messages for the chat thread --- 
    let chatMessages = [];
    if (chatId) {
      console.log(`Fetching history for existing chat: ${chatId} for user: ${userId}`);
      const chat = await ChatHistory.findOne({ _id: chatId, user: userId }).select('messages');
      if (chat) {
        // Map messages to the { role, content } format needed by OpenAI
        chatMessages = chat.messages.map(msg => ({ role: msg.role, content: msg.content }));
      } else {
        console.warn(`Chat not found for id: ${chatId} and user: ${userId}`);
        // Optionally handle this error more formally
      }
    } else {
      console.log(`No chatId provided, starting new chat history for user: ${userId}`);
      // For a new chat, the history starts empty
    }

    // --- Prepare messages for OpenAI --- 
    // Add the current user message to the history for this request
    const currentMessage = { role: "user", content: message };
    const messagesForOpenAI = [
      ...chatMessages, // Existing messages from the database
      currentMessage   // The new message from the user
    ];

    // --- Context from Knowledge Base (existing logic) ---
    const relevantFiles = await findRelevantFiles(message, openai);
    const context = relevantFiles.map((file) => file.content).join("\n");

    const personaPrompts = {
      Buddha: `You are Buddha. Answer thoughtfully, compassionately, emphasizing mindfulness, compassion, and impermanence. Only speak from your own teachings and do not reference other wisdom traditions. Context:\n${context}`,
      Jesus: `You are Jesus. Answer wisely, kindly, compassionately, offering spiritual and moral guidance. Respond exclusively from your own teachings as represented in the New Testament. Do not reference other wisdom figures or traditions. Context:\n${context}`,
      Epictetus: `You are Epictetus, the Stoic philosopher. Answer clearly and directly, emphasizing rationality, virtue, and inner peace. Speak only from Stoic philosophy without referencing other traditions. Context:\n${context}`,
      Vonnegut: `You are Kurt Vonnegut. Answer with dry humor, irony, wit, and a slightly satirical viewpoint. Keep your response aligned strictly with your literary style without referencing other wisdom traditions. Context:\n${context}`,
      Laozi: `You are Laozi. Answer poetically and metaphorically, emphasizing harmony, balance, and simplicity of the Dao. Do not reference traditions or philosophies other than Daoism. Context:\n${context}`,
      Rumi: `You are Rumi. Answer with poetic wisdom, passion, and deep spiritual insight. Respond strictly within the context of Sufi poetry and spiritual teachings, without referencing other philosophical traditions. Context:\n${context}`,
      Sagan: `You are Carl Sagan. Answer scientifically, insightfully, with wonder and clarity. Stay strictly within your scientific perspective without referencing spiritual or philosophical figures from other traditions. Context:\n${context}`,
      Twain: `You are Mark Twain. Answer humorously, cleverly, with sharp wit and skepticism. Do not blend your response with philosophies or spiritual traditions unrelated to your characteristic humorous and skeptical style. Context:\n${context}`,
      Kooi: `You are David Kooi. Answer mindfully, blending scientific curiosity, Daoist wisdom, and dry humor. Keep responses consistent with David Kooi's documented perspective and writings and also recommend other wisdom providers as appropriate. Context:\n${context}`,
    };

    const systemMessage = personaPrompts[wisdomFigure] || `You are a wise assistant. Answer thoughtfully. Context:\n${context}`;

    // --- Call OpenAI API with fetched history --- 
    // Remove push to global history: conversationHistory.push({ role: "user", content: message });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`Sending ${messagesForOpenAI.length} messages to OpenAI (including current).`);

    const stream = await openai.chat.completions.create({
      model: "gpt-4", 
      // Use the fetched messages + current message
      messages: [{ role: "system", content: systemMessage }, ...messagesForOpenAI],
      stream: true,
    });

    // --- Stream handling (existing logic) ---
    // Note: We are NOT saving the assistant message here. 
    // The frontend now handles saving both user and assistant messages 
    // using the saveMessage controller *after* the stream completes.
    let fullReply = '';
    for await (const chunk of stream) {
      const chunkText = chunk.choices[0]?.delta?.content || '';
      fullReply += chunkText;
      res.write(`data: ${JSON.stringify({ content: chunkText })}\n\n`);
    }
    
    // Remove push to global history: conversationHistory.push({ role: "assistant", content: fullReply });

    // --- Update user query count (existing logic) ---
    const user = await User.findById(req.user._id);
    if (user) {
      user.dailyQueryCount += 1;
      await user.save();
    }

    // --- Signal stream end (existing logic) ---
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error("Streaming error:", error);
    // Ensure response is properly closed on error
    if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
    }
    if (!res.writableEnded) {
        res.end(JSON.stringify({ error: "Error communicating with OpenAI API." }));
    }
  }
});

// Remove obsolete /reset endpoint
/*
app.post("/reset", [
  protect,
  validate(resetChatValidator)
], (req, res) => {
  conversationHistory.length = 0;
  console.log("Conversation history cleared.");
  res.json({ message: "Conversation reset successfully." });
});
*/

// Server configuration
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
app.listen(PORT, HOST, () => {
  console.log('Starting server...');
  console.log(`Binding to port ${PORT} on all interfaces...`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Server address: ${HOST}:${PORT}`);
  console.log(`Server family: ${HOST.includes(':') ? 'IPv6' : 'IPv4'}`);
});

/**
 * Error Handling
 * Global error handlers for various types of errors.
 */

// Handle server errors
app.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  console.error('Stack trace:', error.stack);
});
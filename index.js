import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";
import { loadTextFiles } from "./loadTextFiles.js";
import fs from "fs";
import { cosineSimilarity } from "./utils.js";
import rateLimit from "express-rate-limit";

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// Configure CORS
app.use(cors()); // Temporary open CORS for testing
app.use(express.json());
app.use(bodyParser.json());

// Rate-limiting middleware to prevent abuse and unexpected costs
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  handler: (req, res) => {
    res.status(429).json({
      message: "Slow down, wise seeker! 🧘‍♂️ You've reached your limit—pause, reflect, and return soon.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate-limiter specifically to the /chat route
app.use('/chat', limiter);

// Knowledge base setup
const knowledgeDir = process.env.KNOWLEDGE_DIR || "./knowledge";
const conversationHistory = [];

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

// Updated Chat endpoint with streaming (Server-Sent Events)
app.get("/chat-stream", async (req, res) => {
  try {
    const { message, wisdomFigure } = req.query;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid or missing 'message' in request query." });
    }

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
    
      Kooi: `You are David Kooi. Answer mindfully, blending scientific curiosity, Daoist wisdom, and dry humor. Keep responses consistent with David Kooi’s documented perspective and writings without explicitly referencing other unrelated wisdom traditions. Context:\n${context}`,
    };
    

    const systemMessage = personaPrompts[wisdomFigure] || `You are a wise assistant. Answer thoughtfully. Context:\n${context}`;

    conversationHistory.push({ role: "user", content: message });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemMessage }, ...conversationHistory],
      stream: true,
    });

    let fullReply = '';

    for await (const chunk of stream) {
      const chunkText = chunk.choices[0]?.delta?.content || '';
      fullReply += chunkText;
      res.write(`data: ${JSON.stringify({ content: chunkText })}\n\n`);
    }

    conversationHistory.push({ role: "assistant", content: fullReply });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error("Streaming error:", error);
    res.status(500).send("Error communicating with OpenAI API.");
  }
});

// Endpoint to reset conversation
app.post("/reset", (req, res) => {
  conversationHistory.length = 0;
  console.log("Conversation history cleared.");
  res.json({ message: "Conversation reset successfully." });
});

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

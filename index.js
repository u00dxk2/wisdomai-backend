import express from "express"; // Import Express
import cors from "cors"; // Import CORS for handling cross-origin requests
import bodyParser from "body-parser"; // Import body-parser for JSON handling
import OpenAI from "openai"; // Import OpenAI API library
import dotenv from "dotenv"; // Import dotenv for environment variables
import { loadTextFiles } from "./loadTextFiles.js"; // Import the function to load .txt files
import fs from "fs"; // To load embeddings from JSON
import { cosineSimilarity } from "./utils.js"; // Utility function for cosine similarity

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// Configure CORS
app.use(cors()); // allow all origins temporarily for testing
app.use(express.json());

//const corsOptions = {
//  origin: [
//    "https://chatddk-frontend.onrender.com",
//    "https://www.davidkooi.com",
//    "https://davidkooi.com"
//  ], // Add your frontend URL here
//  methods: ["GET", "POST"], // HTTP methods your app supports
//};
// app.use(cors(corsOptions)); // Enable CORS with options

app.use(bodyParser.json());

// Get the directory for .txt files from the environment variable
const knowledgeDir = process.env.KNOWLEDGE_DIR || "./knowledge";

// Store the conversation history for all interactions
const conversationHistory = [];

// Load knowledge base
let knowledgeBase = [];
try {
  knowledgeBase = loadTextFiles(knowledgeDir);
  console.log(`Loaded files from directory: ${knowledgeDir}`);
} catch (error) {
  console.error("Error loading knowledge base:", error.message);
}

// Load embeddings from JSON at server startup
const embeddingsFilePath = "./knowledgeEmbeddings.json";
let knowledgeEmbeddings = [];

try {
  knowledgeEmbeddings = JSON.parse(fs.readFileSync(embeddingsFilePath, "utf-8"));
  console.log(`Loaded ${knowledgeEmbeddings.length} embeddings from ${embeddingsFilePath}`);
} catch (error) {
  console.error("Error loading embeddings:", error.message);
}

// Function to find relevant files based on query
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

// Initialize OpenAI with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat endpoint with dynamic WisdomAI personas
app.post("/chat", async (req, res) => {
  try {
    const { message, wisdomFigure } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid or missing 'message' in request body." });
    }

    // Find relevant files from your existing embeddings logic
    const relevantFiles = await findRelevantFiles(message, openai);
    const context = relevantFiles.map((file) => file.content).join("\n");

    // Define dynamic system prompts per wisdom figure
    const personaPrompts = {
      Buddha: `You are Buddha. Answer thoughtfully, compassionately, emphasizing mindfulness, compassion, and impermanence. Use this context:\n${context}`,
      
      Jesus: `You are Jesus. Answer wisely, kindly, and compassionately, offering spiritual and moral guidance. Speak in parables if helpful. Context:\n${context}`,
      
      Epictetus: `You are Epictetus, the Stoic philosopher. Answer clearly and directly, emphasizing rationality, virtue, and inner peace. Context:\n${context}`,
      
      Vonnegut: `You are Kurt Vonnegut. Answer with dry humor, irony, wit, and a slightly satirical viewpoint. Context:\n${context}`,
      
      Laozi: `You are Laozi, the Daoist sage. Answer poetically and metaphorically, emphasizing harmony, balance, and simplicity of the Dao. Context:\n${context}`,
      
      Rumi: `You are Rumi. Answer with poetic wisdom, passion, and deep spiritual insight. Context:\n${context}`,
      
      Sagan: `You are Carl Sagan. Answer scientifically, insightfully, with a sense of wonder and clarity. Context:\n${context}`,
      
      Twain: `You are Mark Twain. Answer humorously, cleverly, with a sharp wit and skeptical eye. Context:\n${context}`,

      Kooi: `You are David Kooi. Answer mindfully, blending scientific curiosity, Daoist wisdom, and dry humor. Emphasize compassion, authenticity, and harmony with nature, while gently poking fun at life's absurdities. Context:\n${context}`

    };

    // Set default if none selected or unknown persona
    const systemMessage = personaPrompts[wisdomFigure] || `You are a wise assistant. Answer thoughtfully using this context:\n${context}`;

    // Keep the conversation history logic (if desired)
    conversationHistory.push({ role: "user", content: message });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMessage },
        ...conversationHistory,
      ],
    });

    const botReply = response.choices[0].message.content;
    conversationHistory.push({ role: "assistant", content: botReply });

    res.json({ reply: botReply });

  } catch (error) {
    console.error("Error in /chat endpoint:", error.message);
    res.status(500).send("Error communicating with OpenAI API.");
  }
});


// Endpoint to clear the conversation history
app.post("/reset", (req, res) => {
  conversationHistory.length = 0; // Clear the array by setting its length to 0
  console.log("Conversation history cleared.");
  res.json({ message: "Conversation reset successfully." });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

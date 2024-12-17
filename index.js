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
app.use(cors());
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

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid or missing 'message' in request body." });
    }

    const relevantFiles = await findRelevantFiles(message, openai);

    const context = relevantFiles.map((file) => file.content).join("\n");

    const systemMessage = `You are ChatDDK, a chatbot version of David Kooi. 
    Use the following knowledge base to answer questions:\n${context}
    ...`; // Truncated system message for readability

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

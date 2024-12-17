import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
import { loadTextFiles } from "./loadTextFiles.js"; // Import the file loader

// Load environment variables
dotenv.config();

// Initialize OpenAI with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to generate embeddings for an array of text objects
const generateEmbeddings = async (texts) => {
  return Promise.all(
    texts.map(async (textObj) => {
      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-ada-002", // Use the embedding model
          input: textObj.content, // File content as input
        });
        return {
          fileName: textObj.fileName,
          content: textObj.content,
          embedding: response.data[0].embedding, // Store the embedding
        };
      } catch (error) {
        console.error(`Error generating embedding for ${textObj.fileName}:`, error);
        return null; // Gracefully handle errors
      }
    })
  );
};

// Main function to load files, generate embeddings, and save them
const generateAndSaveEmbeddings = async () => {
  // Step 1: Load .txt files
  const knowledgeDir = process.env.KNOWLEDGE_DIR || "./knowledge"; // Directory for .txt files
  const knowledgeBase = loadTextFiles(knowledgeDir); // Load all text files
  console.log(`Loaded ${knowledgeBase.length} files from ${knowledgeDir}`);

  // Step 2: Generate embeddings for the files
  console.log("Generating embeddings...");
  const knowledgeEmbeddings = await generateEmbeddings(knowledgeBase);

  // Step 3: Remove any null entries (files with errors)
  const validEmbeddings = knowledgeEmbeddings.filter((item) => item !== null);

  // Step 4: Save embeddings to a JSON file
  const savePath = "./knowledgeEmbeddings.json";
  fs.writeFileSync(savePath, JSON.stringify(validEmbeddings, null, 2)); // Save as JSON with 2-space indentation
  console.log(`Embeddings saved to ${savePath}`);
};

// Call the main function
generateAndSaveEmbeddings();

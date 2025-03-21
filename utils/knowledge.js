/**
 * @fileoverview Knowledge base management and semantic search functionality.
 * This module handles loading, managing, and searching through the knowledge base
 * using OpenAI embeddings for semantic similarity matching.
 */

import fs from 'fs';
import { cosineSimilarity } from '../utils.js';
import { loadTextFiles } from '../loadTextFiles.js';

/**
 * @constant {string} knowledgeDir - Directory containing knowledge base text files
 * Default is "./knowledge" or value from KNOWLEDGE_DIR environment variable
 */
const knowledgeDir = process.env.KNOWLEDGE_DIR || "./knowledge";

/**
 * @constant {string} embeddingsFilePath - Path to the pre-computed embeddings JSON file
 */
const embeddingsFilePath = "./knowledgeEmbeddings.json";

/**
 * @type {Array<Object>} knowledgeBase - Array of loaded text files with their content
 */
let knowledgeBase = [];
try {
  knowledgeBase = loadTextFiles(knowledgeDir);
  console.log(`Loaded files from directory: ${knowledgeDir}`);
} catch (error) {
  console.error("Error loading knowledge base:", error.message);
}

/**
 * @type {Array<Object>} knowledgeEmbeddings - Array of pre-computed embeddings for knowledge base content
 * @property {string} content - The text content associated with the embedding
 * @property {Array<number>} embedding - The vector embedding of the content
 * @property {string} [source] - Optional source/filename of the content
 */
let knowledgeEmbeddings = [];
try {
  knowledgeEmbeddings = JSON.parse(fs.readFileSync(embeddingsFilePath, "utf-8"));
  console.log(`Loaded ${knowledgeEmbeddings.length} embeddings from ${embeddingsFilePath}`);
} catch (error) {
  console.error("Error loading embeddings:", error.message);
}

/**
 * Find the most relevant files from the knowledge base for a given query
 * using semantic similarity with OpenAI embeddings.
 * 
 * @param {string} query - The user's message/question to find relevant context for
 * @param {OpenAI} openai - OpenAI client instance for generating embeddings
 * @returns {Promise<Array<Object>>} Top 3 most relevant files with their content and similarity scores
 * @property {string} content - The text content of the relevant file
 * @property {number} similarity - Cosine similarity score (0-1) with the query
 * @property {string} [source] - Source/filename of the content if available
 * 
 * @throws {Error} If embedding generation fails or knowledge base is not properly loaded
 */
export const findRelevantFiles = async (query, openai) => {
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

/**
 * Reload both the knowledge base text files and their embeddings from disk.
 * Useful when the knowledge base content has been updated.
 * 
 * @returns {Promise<void>}
 * @throws {Error} If either knowledge base or embeddings cannot be loaded
 */
export const reloadKnowledge = async () => {
  try {
    knowledgeBase = loadTextFiles(knowledgeDir);
    knowledgeEmbeddings = JSON.parse(fs.readFileSync(embeddingsFilePath, "utf-8"));
    console.log(`Reloaded knowledge base: ${knowledgeBase.length} files, ${knowledgeEmbeddings.length} embeddings`);
  } catch (error) {
    console.error("Error reloading knowledge base:", error.message);
    throw error;
  }
}; 
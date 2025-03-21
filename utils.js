/**
 * @fileoverview Utility functions for the WisdomAI application.
 * Contains mathematical and helper functions used across the application.
 */

/**
 * Calculate the cosine similarity between two vectors.
 * Used for comparing embeddings in semantic search.
 * 
 * @param {Array<number>} vecA - First vector
 * @param {Array<number>} vecB - Second vector
 * @returns {number} Cosine similarity score between 0 and 1
 * 
 * @example
 * const vec1 = [1, 2, 3];
 * const vec2 = [4, 5, 6];
 * const similarity = cosineSimilarity(vec1, vec2);
 */
export const cosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  };
  
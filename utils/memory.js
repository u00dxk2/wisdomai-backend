import UserMemory from '../models/UserMemory.js';
import ChatHistory from '../models/ChatHistory.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Retrieves memory for a specific user, including personal facts, preferences and relevant conversation history
 * @param {string} userId - The user's ID
 * @param {string} currentMessage - The current message from the user (optional)
 * @returns {Object} Memory object with personal facts, preferences, and conversation context
 */
export async function getUserMemory(userId, currentMessage) {
  // Get or create memory entry for user
  let memory = await UserMemory.findOne({ user: userId });
  if (!memory) {
    memory = new UserMemory({ user: userId });
    await memory.save();
  }
  
  // Get relevant chat history
  const recentChats = await ChatHistory.find({ user: userId })
    .sort({ updatedAt: -1 })
    .limit(5);
  
  // Extract messages
  const chatHistory = recentChats.flatMap(chat => 
    chat.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }))
  );
  
  // Get relevant subset of history
  let relevantHistory = '';
  if (chatHistory.length > 0 && currentMessage) {
    // Use simple recency if under 20 messages
    if (chatHistory.length < 20) {
      relevantHistory = chatHistory
        .slice(-10)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
    } else {
      // For larger histories, use a summarized version
      relevantHistory = memory.conversationSummary || '';
    }
  }
  
  return {
    personalFacts: memory.personalFacts || [],
    preferences: memory.preferences || new Map(),
    conversationSummary: memory.conversationSummary || '',
    relevantHistory,
    fullMemory: memory
  };
}

/**
 * Updates a user's memory based on new conversation
 * @param {string} userId - The user's ID
 * @param {Object} params - Object containing conversation details
 * @param {string} params.userMessage - The user's message
 * @param {string} params.aiResponse - The AI's response
 * @param {string} params.wisdomFigure - The wisdom figure used
 */
export async function updateUserMemory(userId, { userMessage, aiResponse, wisdomFigure }) {
  // Find or create memory
  let memory = await UserMemory.findOne({ user: userId });
  if (!memory) {
    memory = new UserMemory({ user: userId });
  }
  
  // Check if we should update the summary (e.g., every 5 conversations)
  const chatCount = await ChatHistory.countDocuments({ user: userId });
  if (chatCount % 5 === 0) {
    const summary = await generateConversationSummary(userId);
    memory.conversationSummary = summary;
    memory.lastUpdated = new Date();
    await memory.save();
  }
  
  // Extract facts and preferences if needed
  const shouldExtractFacts = chatCount % 3 === 0;
  if (shouldExtractFacts) {
    await extractFactsAndPreferences(userId, userMessage, aiResponse);
  }
}

/**
 * Generates a summary of the user's recent conversations
 * @param {string} userId - The user's ID
 * @returns {string} A summary of key points from conversations
 */
async function generateConversationSummary(userId) {
  // Get recent chats
  const recentChats = await ChatHistory.find({ user: userId })
    .sort({ updatedAt: -1 })
    .limit(10);
    
  // Extract messages
  const allMessages = recentChats.flatMap(chat => 
    chat.messages.map(msg => `${msg.role}: ${msg.content}`));
    
  // Use OpenAI to summarize
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { 
          role: "system", 
          content: "Your task is to create a concise summary of key points from these conversations. Focus on extracting important facts about the user, their interests, problems they've mentioned, and preferences. This summary will be used as context for future conversations." 
        },
        { role: "user", content: allMessages.join('\n') }
      ]
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating conversation summary:', error);
    return '';
  }
}

/**
 * Extracts facts and preferences about the user from conversation
 * @param {string} userId - The user's ID
 * @param {string} userMessage - The user's message
 * @param {string} aiResponse - The AI's response
 */
async function extractFactsAndPreferences(userId, userMessage, aiResponse) {
  try {
    // Use AI to extract facts and preferences
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { 
          role: "system", 
          content: "Extract facts about the user and their preferences from this conversation. Return as JSON with format: { 'personalFacts': ['fact1', 'fact2'], 'preferences': { 'topic': 'value' } }" 
        },
        { 
          role: "user", 
          content: `User message: ${userMessage}\nAI response: ${aiResponse}` 
        }
      ]
    });
    
    // Parse response
    const extractionText = response.choices[0].message.content;
    let extraction;
    try {
      // Find the JSON part in the response
      const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
      extraction = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (parseError) {
      console.error('Error parsing extraction JSON:', parseError);
      return;
    }
    
    // Update memory
    const memory = await UserMemory.findOne({ user: userId });
    
    if (extraction.personalFacts && Array.isArray(extraction.personalFacts)) {
      // Add new facts, avoiding duplicates
      const existingFacts = new Set(memory.personalFacts.map(f => f.content));
      const newFacts = extraction.personalFacts
        .filter(fact => !existingFacts.has(fact))
        .map(fact => ({ content: fact, source: 'observation', timestamp: new Date() }));
        
      if (newFacts.length > 0) {
        memory.personalFacts.push(...newFacts);
      }
    }
    
    if (extraction.preferences && typeof extraction.preferences === 'object') {
      // Update preferences Map
      const prefsMap = memory.preferences || new Map();
      Object.entries(extraction.preferences).forEach(([key, value]) => {
        prefsMap.set(key, value);
      });
      memory.preferences = prefsMap;
    }
    
    memory.lastUpdated = new Date();
    await memory.save();
  } catch (error) {
    console.error('Error extracting facts and preferences:', error);
  }
} 
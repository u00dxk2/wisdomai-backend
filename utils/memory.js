import UserMemory from '../models/UserMemory.js';
import ChatHistory from '../models/ChatHistory.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_HISTORY_FOR_PROMPT = 10; // Max messages from current chat
const MAX_SUMMARY_AGE_DAYS = 7; // How old can the general summary be?

/**
 * Retrieves memory for a specific user.
 * @param {string} userId - The user's ID
 * @param {string} currentMessage - The current message from the user (optional, for future relevance filtering)
 * @param {string} chatId - The ID of the current chat (optional, null for new chats)
 * @returns {Object} Memory object { personalFacts, preferences, relevantHistory }
 */
export async function getUserMemory(userId, currentMessage, chatId) {
  // 1. Get user's general memory (facts, prefs, summary)
  let userMemory = await UserMemory.findOne({ user: userId });
  if (!userMemory) {
    userMemory = { personalFacts: [], preferences: new Map(), conversationSummary: '' };
  } else {
    // Convert preferences from plain object back to Map if needed (Mongoose might store it as Object)
    if (userMemory.preferences && !(userMemory.preferences instanceof Map)) {
      userMemory.preferences = new Map(Object.entries(userMemory.preferences));
    }
  }
  
  const personalFacts = userMemory.personalFacts || [];
  const preferences = userMemory.preferences || new Map();
  
  // Check if summary is recent enough
  let generalSummary = '';
  if (userMemory.conversationSummary && userMemory.lastUpdated) {
      const summaryAgeDays = (new Date() - new Date(userMemory.lastUpdated)) / (1000 * 60 * 60 * 24);
      if (summaryAgeDays <= MAX_SUMMARY_AGE_DAYS) {
          generalSummary = userMemory.conversationSummary;
      }
  }

  // 2. Get specific history for the current chat if chatId is provided
  let currentChatMessages = [];
  if (chatId) {
    const currentChat = await ChatHistory.findOne({ _id: chatId, user: userId });
    if (currentChat) {
      // Get the last N messages from this specific chat
      currentChatMessages = currentChat.messages.slice(-MAX_HISTORY_FOR_PROMPT);
    }
  }

  // 3. Combine context for the prompt
  // Start with the current chat history
  let relevantHistory = currentChatMessages
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  // Add the general summary if it exists and is different from current chat
  if (generalSummary && relevantHistory !== generalSummary) { // Avoid duplication if summary covers current chat
      relevantHistory = `General summary of past interactions:\n${generalSummary}\n\nCurrent conversation:\n${relevantHistory}`;
  }
  
  // If no specific chat history, just use the summary
  if (!relevantHistory && generalSummary) {
       relevantHistory = `General summary of past interactions:\n${generalSummary}`;
  }

  return {
    personalFacts, // Array of fact objects { content, source, timestamp }
    preferences,   // Map
    relevantHistory // String for prompt injection
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
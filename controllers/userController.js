import User from '../models/User.js';
import UserMemory from '../models/UserMemory.js';

/**
 * Get the current user's profile with memory data
 * @route GET /api/users/profile
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get basic user data
    const user = await User.findById(userId).select('-password');
    
    // Get memory data
    const memory = await UserMemory.findOne({ user: userId });
    
    // Format for frontend
    const profile = {
      ...user.toObject(),
      memory: {
        recentTopics: [],
        personalFacts: []
      }
    };
    
    if (memory) {
      // Extract topics from conversation summary
      if (memory.conversationSummary) {
        // Simple topic extraction - could be more sophisticated
        const topics = memory.conversationSummary
          .split('.')
          .filter(sentence => 
            sentence.toLowerCase().includes('interested in') || 
            sentence.toLowerCase().includes('talked about'))
          .map(sentence => sentence.trim());
          
        profile.memory.recentTopics = topics.slice(0, 3);
      }
      
      // Get personal facts, sorted by recency
      profile.memory.personalFacts = memory.personalFacts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map(fact => fact.content);
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
}; 
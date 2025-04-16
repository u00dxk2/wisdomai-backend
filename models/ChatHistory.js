import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  figure: {
    type: String,
    enum: ['Buddha', 'Jesus', 'Epictetus', 'Vonnegut', 'Laozi', 'Rumi', 'Sagan', 'Twain', 'Kooi'],
    required: function() { return this.role === 'assistant'; }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    default: 'New Chat'
  },
  messages: [messageSchema],
  lastMessage: {
    type: String
  }
}, { 
  timestamps: true 
});

// Helper function to generate a title from content
function generateTitle(content) {
  // Remove any special characters and extra whitespace
  const cleaned = content.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Split into words and take first 6 words
  const words = cleaned.split(' ').slice(0, 6);
  
  // If the content is longer than 6 words, add ellipsis
  const title = words.join(' ') + (cleaned.split(' ').length > 6 ? '...' : '');
  
  return title;
}

// Pre-save middleware to generate title from first user message
chatHistorySchema.pre('save', function(next) {
  if (this.isNew || this.title === 'New Chat') {
    const firstUserMessage = this.messages.find(msg => msg.role === 'user');
    if (firstUserMessage) {
      this.title = generateTitle(firstUserMessage.content);
    }
  }
  next();
});

export default mongoose.model('ChatHistory', chatHistorySchema); 
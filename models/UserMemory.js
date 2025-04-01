import mongoose from 'mongoose';

const memoryItemSchema = new mongoose.Schema({
  content: { type: String, required: true },
  source: { type: String, enum: ['observation', 'fact', 'preference'] },
  timestamp: { type: Date, default: Date.now }
});

const userMemorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  personalFacts: [memoryItemSchema],
  preferences: { type: Map, of: String },
  conversationSummary: { type: String },
  lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model('UserMemory', userMemorySchema); 
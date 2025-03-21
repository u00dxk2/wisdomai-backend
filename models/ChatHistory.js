const mongoose = require('mongoose');

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
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messages: [messageSchema],
  title: {
    type: String,
    default: 'New Chat'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  summary: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Update lastUpdated whenever messages are modified
chatHistorySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('ChatHistory', chatHistorySchema); 
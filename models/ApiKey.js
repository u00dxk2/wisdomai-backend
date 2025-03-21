/**
 * @fileoverview API Key model for the WisdomAI application.
 * Manages API keys for programmatic access to the WisdomAI API.
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * API Key Schema
 * @type {mongoose.Schema}
 */
const apiKeySchema = new mongoose.Schema({
  /**
   * Reference to the user who owns this API key
   * @type {mongoose.Schema.Types.ObjectId}
   */
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  /**
   * Hashed API key string
   * @type {string}
   */
  key: {
    type: String,
    required: true,
    unique: true
  },
  /**
   * Name/description for the API key
   * @type {string}
   */
  name: {
    type: String,
    required: true,
    trim: true
  },
  /**
   * Expiration date of the API key
   * @type {Date}
   */
  expiresAt: {
    type: Date,
    required: true
  },
  /**
   * Timestamp of the last usage
   * @type {Date}
   */
  lastUsed: {
    type: Date,
    default: null
  },
  /**
   * Total number of times the key has been used
   * @type {number}
   */
  usageCount: {
    type: Number,
    default: 0
  },
  /**
   * Whether the key is currently active
   * @type {boolean}
   */
  isActive: {
    type: Boolean,
    default: true
  },
  /**
   * Key creation timestamp
   * @type {Date}
   */
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Generate a secure random API key
 * @returns {string} A base64-encoded random string of 32 bytes
 */
apiKeySchema.statics.generateKey = function() {
  return crypto.randomBytes(32).toString('base64');
};

/**
 * Check if the API key has expired
 * @returns {boolean} True if the key has expired, false otherwise
 */
apiKeySchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

/**
 * Update the usage statistics for this API key
 * @returns {Promise<void>}
 */
apiKeySchema.methods.recordUsage = async function() {
  this.lastUsed = new Date();
  this.usageCount += 1;
  await this.save();
};

/**
 * Pre-save middleware to hash the API key before saving
 * @param {Function} next - Express next middleware function
 */
apiKeySchema.pre('save', function(next) {
  if (this.isModified('key')) {
    // Store a hashed version of the key
    this.key = crypto
      .createHash('sha256')
      .update(this.key)
      .digest('hex');
  }
  next();
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

export default ApiKey; 
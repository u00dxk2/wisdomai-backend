/**
 * @fileoverview User model for the WisdomAI application.
 * Defines the schema and methods for user authentication and management.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Schema
 * @type {mongoose.Schema}
 */
const userSchema = new mongoose.Schema({
  /**
   * User's unique username
   * @type {string}
   */
  username: {
    type: String,
    required: [true, 'Please add a username'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
  },
  /**
   * User's email address
   * @type {string}
   */
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  /**
   * User's hashed password
   * @type {string}
   */
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false,
  },
  /**
   * Whether the user has premium status
   * @type {boolean}
   */
  isPremium: {
    type: Boolean,
    default: false,
  },
  /**
   * Number of queries made by the user today
   * @type {number}
   */
  dailyQueryCount: {
    type: Number,
    default: 0,
  },
  /**
   * Timestamp of the last query count reset
   * @type {Date}
   */
  lastQueryReset: {
    type: Date,
    default: Date.now,
  },
  /**
   * Array of favorite chat responses
   * @type {Array<mongoose.Schema.Types.ObjectId>}
   */
  favoriteResponses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatResponse',
  }],
  /**
   * User account creation timestamp
   * @type {Date}
   */
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Pre-save middleware to hash password before saving
 * @param {Function} next - Express next middleware function
 */
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compare entered password with hashed password in database
 * @param {string} enteredPassword - Password to compare
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 */
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
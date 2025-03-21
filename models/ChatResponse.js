/**
 * @fileoverview Chat Response model for the WisdomAI application.
 * Stores chat interactions between users and wisdom figures.
 */

import mongoose from 'mongoose';

/**
 * Chat Response Schema
 * @type {mongoose.Schema}
 */
const chatResponseSchema = new mongoose.Schema({
  /**
   * Reference to the user who made the query
   * @type {mongoose.Schema.Types.ObjectId}
   */
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  /**
   * The user's query or question
   * @type {string}
   */
  query: {
    type: String,
    required: true,
  },
  /**
   * The wisdom figure's response
   * @type {string}
   */
  response: {
    type: String,
    required: true,
  },
  /**
   * The wisdom figure who provided the response
   * @type {string}
   */
  wisdomFigure: {
    type: String,
    required: true,
  },
  /**
   * Whether the user has marked this response as a favorite
   * @type {boolean}
   */
  isFavorite: {
    type: Boolean,
    default: false,
  },
  /**
   * Timestamp when the response was created
   * @type {Date}
   */
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('ChatResponse', chatResponseSchema);
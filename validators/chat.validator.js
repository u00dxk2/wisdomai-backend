/**
 * @fileoverview Validation rules for chat-related routes.
 * Defines validation schemas for chat streaming and conversation reset.
 */

import { query, body, param } from 'express-validator';

/**
 * Validation rules for chat streaming requests
 * @type {Array<Object>}
 */
export const chatStreamValidator = [
  /**
   * Message validation
   * - Required
   * - String type
   * - 1-1000 characters
   * - No HTML/script tags or special characters
   */
  query('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isString()
    .withMessage('Message must be a string')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters')
    .matches(/^[^<>{}]*$/)
    .withMessage('Message contains invalid characters'),

  /**
   * Wisdom figure validation
   * - Required
   * - Must be one of the predefined wisdom figures
   */
  query('wisdomFigure')
    .trim()
    .notEmpty()
    .withMessage('Wisdom figure is required')
    .isIn(['Buddha', 'Jesus', 'Epictetus', 'Vonnegut', 'Laozi', 'Rumi', 'Sagan', 'Twain', 'Kooi'])
    .withMessage('Invalid wisdom figure selected'),

  /**
   * JWT token validation (optional)
   * - Valid JWT format if provided
   */
  query('token')
    .optional()
    .isJWT()
    .withMessage('Invalid token format')
];

/**
 * Validation rules for chat reset requests
 * @type {Array<Object>}
 */
export const resetChatValidator = [
  /**
   * User ID validation (optional)
   * - Valid MongoDB ObjectId format if provided
   */
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID format'),
  
  /**
   * Clear all flag validation (optional)
   * - Boolean value
   */
  body('clearAll')
    .optional()
    .isBoolean()
    .withMessage('clearAll must be a boolean value')
]; 
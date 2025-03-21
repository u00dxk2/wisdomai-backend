/**
 * @fileoverview Input sanitization and validation middleware.
 * Provides various sanitization functions to prevent XSS, NoSQL injection,
 * and other security vulnerabilities.
 */

import { body, query, validationResult } from 'express-validator';

/**
 * Helper function to handle express-validator validation results.
 * 
 * @middleware
 * @function handleValidationErrors
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @throws {Object} 400 - Bad Request (validation errors)
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * Middleware array for sanitizing and validating chat requests.
 * Validates message content and wisdom figure selection.
 * 
 * @middleware
 * @type {Array<Function>}
 * 
 * @validates
 * - message: Required, string, max 1000 chars, trimmed, escaped
 * - wisdomFigure: Required, must be one of the valid options
 * 
 * @example
 * router.get('/chat', sanitizeChatRequest, (req, res) => {
 *   // Access sanitized query parameters
 *   const { message, wisdomFigure } = req.query;
 * });
 */
export const sanitizeChatRequest = [
  query('message')
    .trim()                          // Remove whitespace
    .notEmpty()                      // Ensure message exists
    .withMessage('Message is required')
    .isString()                      // Must be string
    .isLength({ max: 1000 })         // Limit length
    .withMessage('Message must be less than 1000 characters')
    .escape(),                       // Escape special characters

  query('wisdomFigure')
    .trim()
    .notEmpty()
    .withMessage('Wisdom figure is required')
    .isIn(['Buddha', 'Jesus', 'Epictetus', 'Vonnegut', 'Laozi', 'Rumi', 'Sagan', 'Twain', 'Kooi'])
    .withMessage('Invalid wisdom figure selected')
    .escape(),

  handleValidationErrors
];

/**
 * Middleware array for sanitizing and validating authentication requests.
 * Validates email format and password requirements.
 * 
 * @middleware
 * @type {Array<Function>}
 * 
 * @validates
 * - email: Required, valid email format, normalized
 * - password: Required, min 8 chars, must contain letter and number
 * 
 * @example
 * router.post('/register', sanitizeAuthRequest, (req, res) => {
 *   // Access sanitized body parameters
 *   const { email, password } = req.body;
 * });
 */
export const sanitizeAuthRequest = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/)
    .withMessage('Password must contain at least one letter and one number'),

  handleValidationErrors
];

/**
 * Sanitizes MongoDB query parameters to prevent NoSQL injection.
 * Removes MongoDB operators from string queries.
 * 
 * @function sanitizeMongoQuery
 * 
 * @param {*} query - Query value to sanitize
 * @returns {*} Sanitized query value
 * 
 * @example
 * const sanitizedId = sanitizeMongoQuery(req.params.id);
 * const user = await User.findById(sanitizedId);
 */
export const sanitizeMongoQuery = (query) => {
  if (typeof query !== 'string') return query;
  
  // Remove MongoDB operators
  return query.replace(/\$[a-zA-Z]+/g, '');
};

/**
 * General purpose XSS prevention middleware.
 * Sanitizes request query parameters and body content.
 * 
 * @middleware
 * @function preventXSS
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {Object} req.body - Request body
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @description
 * This middleware:
 * 1. Converts special characters to HTML entities
 * 2. Removes dangerous JavaScript/HTML patterns
 * 3. Strips potentially malicious attributes
 * 4. Sanitizes both query parameters and request body
 * 
 * @example
 * // Apply globally to all routes
 * app.use(preventXSS);
 */
export const preventXSS = (req, res, next) => {
  /**
   * Helper function to sanitize individual string values.
   * 
   * @function sanitizeValue
   * @param {*} value - Value to sanitize
   * @returns {*} Sanitized value
   */
  const sanitizeValue = (value) => {
    if (typeof value !== 'string') return value;
    
    return value
      // Convert special characters to HTML entities
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      // Remove dangerous patterns
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+=/gi, '')
      // Remove other potentially dangerous patterns
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<img[^>]+onerror[^>]*>/gi, '');
  };

  // Sanitize query parameters
  if (req.query) {
    for (let key in req.query) {
      req.query[key] = sanitizeValue(req.query[key]);
    }
  }

  // Sanitize body
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeValue(req.body[key]);
      }
    }
  }

  next();
}; 
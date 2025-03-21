/**
 * @fileoverview Express validation middleware for the WisdomAI application.
 * Handles validation of request data using express-validator and formats error responses.
 */

import { validationResult } from 'express-validator';

/**
 * Middleware function to validate request data using express-validator.
 * Runs all provided validations and returns formatted error responses if validation fails.
 * 
 * @param {Array<Object>} validations - Array of express-validator validation chains
 * @returns {Function} Express middleware function
 * 
 * @example
 * // In your route file
 * import { validate } from '../middleware/validator';
 * import { body } from 'express-validator';
 * 
 * const validations = [
 *   body('email').isEmail(),
 *   body('password').isLength({ min: 6 })
 * ];
 * 
 * router.post('/register', validate(validations), (req, res) => {
 *   // Handle validated request
 * });
 * 
 * @returns {Object} 400 - Validation errors
 * @returns {boolean} success - Always false for validation errors
 * @returns {Array<Object>} errors - Array of validation error objects
 * @returns {string} errors[].field - Name of the field with error
 * @returns {string} errors[].message - Error message
 * @returns {*} errors[].value - Invalid value that caused the error
 */
export const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Get validation errors
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors for consistent response
    const formattedErrors = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
      value: err.value
    }));

    // Return validation errors
    return res.status(400).json({
      success: false,
      errors: formattedErrors
    });
  };
}; 
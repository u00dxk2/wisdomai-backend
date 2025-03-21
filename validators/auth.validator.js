/**
 * @fileoverview Validation rules for authentication-related routes.
 * Defines validation schemas for user registration, login, and profile updates.
 */

import { body } from 'express-validator';

/**
 * Validation rules for user registration
 * @type {Array<Object>}
 */
export const registerValidator = [
  /**
   * Username validation
   * - Required
   * - 2-50 characters
   * - Alphanumeric and spaces only
   */
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Username must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9\s]*$/)
    .withMessage('Username can only contain letters, numbers, and spaces'),

  /**
   * Email validation
   * - Required
   * - Valid email format
   * - Normalized (lowercase, remove dots in Gmail addresses)
   */
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  /**
   * Password validation
   * - Required
   * - Minimum 8 characters
   * - Must contain at least one letter and one number
   * - Can contain special characters
   */
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/)
    .withMessage('Password must contain at least one letter and one number')
];

/**
 * Validation rules for user login
 * @type {Array<Object>}
 */
export const loginValidator = [
  /**
   * Email validation
   * - Required
   * - Valid email format
   * - Normalized
   */
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  /**
   * Password validation
   * - Required
   * - Non-empty after trimming
   */
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Validation rules for profile updates
 * @type {Array<Object>}
 */
export const updateProfileValidator = [
  /**
   * Username validation (optional)
   * - 2-50 characters
   * - Alphanumeric and spaces only
   */
  body('username')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Username must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9\s]*$/)
    .withMessage('Username can only contain letters, numbers, and spaces'),

  /**
   * Email validation (optional)
   * - Valid email format
   * - Normalized
   */
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  /**
   * Current password validation (optional)
   * - Required if updating password
   * - Non-empty after trimming
   */
  body('currentPassword')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Current password is required when updating password'),

  /**
   * New password validation (optional)
   * - Minimum 8 characters
   * - Must contain at least one letter and one number
   * - Can contain special characters
   */
  body('newPassword')
    .optional()
    .trim()
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/)
    .withMessage('New password must contain at least one letter and one number')
]; 
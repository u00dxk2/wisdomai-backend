/**
 * @fileoverview Authentication and authorization middleware.
 * Handles JWT token verification and user query limits.
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Middleware to protect routes that require authentication.
 * Verifies JWT tokens from various sources and attaches user to request.
 * 
 * @middleware
 * @function protect
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.headers - Request headers
 * @param {string} [req.headers.authorization] - Bearer token in Authorization header
 * @param {Object} req.query - Request query parameters
 * @param {string} [req.query.token] - JWT token in query string
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @throws {Object} 401 - Not authorized (no token, invalid token, expired token, user not found)
 * 
 * @example
 * // Using as route middleware
 * router.get('/protected-route', protect, (req, res) => {
 *   // Access authenticated user via req.user
 * });
 */
const protect = async (req, res, next) => {
  let token;

  // Check Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check query parameters
  else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from the token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

/**
 * Middleware to check and enforce daily query limits for users.
 * Resets daily count at midnight and enforces limits based on user status.
 * 
 * @middleware
 * @function checkQueryLimit
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object (attached by protect middleware)
 * @param {string} req.user._id - User's MongoDB ID
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @throws {Object} 429 - Too Many Requests (daily limit exceeded)
 * @throws {Object} 500 - Server Error (database error)
 * 
 * @example
 * // Using as route middleware after authentication
 * router.get('/limited-route', protect, checkQueryLimit, (req, res) => {
 *   // Handle request within daily limits
 * });
 */
const checkQueryLimit = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Reset daily count if it's a new day
    const now = new Date();
    const lastReset = new Date(user.lastQueryReset);
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      user.dailyQueryCount = 0;
      user.lastQueryReset = now;
      await user.save();
    }

    // Temporarily increased limit for testing
    if (!user.isPremium && user.dailyQueryCount >= 50) {
      return res.status(429).json({ 
        message: 'Daily query limit reached. Please upgrade to premium for unlimited queries.' 
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking query limit' });
  }
};

export { protect, checkQueryLimit }; 
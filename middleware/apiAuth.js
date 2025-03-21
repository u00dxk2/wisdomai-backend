/**
 * @fileoverview API Key authentication middleware.
 * Handles API key validation, expiration checking, and usage tracking.
 */

import crypto from 'crypto';
import ApiKey from '../models/ApiKey.js';

/**
 * Middleware to authenticate requests using API keys.
 * Validates API keys, checks expiration, tracks usage, and attaches user info.
 * 
 * @middleware
 * @function authenticateApiKey
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.headers - Request headers
 * @param {string} [req.headers['X-API-Key']] - API key in X-API-Key header
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @throws {Object} 401 - Unauthorized (missing key, invalid key, expired key)
 * @throws {Object} 500 - Server Error (database/crypto error)
 * 
 * @description
 * This middleware:
 * 1. Extracts API key from X-API-Key header
 * 2. Hashes the key for secure comparison
 * 3. Validates the key against stored keys
 * 4. Checks key expiration
 * 5. Records key usage
 * 6. Attaches user and key info to request
 * 
 * @example
 * // Using as route middleware
 * router.get('/api-route', authenticateApiKey, (req, res) => {
 *   // Access authenticated user via req.user
 *   // Access API key info via req.apiKey
 * });
 */
export const authenticateApiKey = async (req, res, next) => {
  try {
    // Get API key from header
    const apiKey = req.header('X-API-Key');
    if (!apiKey) {
      return res.status(401).json({ message: 'API key is required' });
    }

    // Hash the provided key for comparison
    const hashedKey = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    // Find and validate the API key
    const key = await ApiKey.findOne({ 
      key: hashedKey,
      isActive: true
    }).populate('user');

    if (!key) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    // Check if key is expired
    if (key.isExpired()) {
      key.isActive = false;
      await key.save();
      return res.status(401).json({ message: 'API key has expired' });
    }

    // Record usage
    await key.recordUsage();

    // Attach user and key info to request
    req.user = key.user;
    req.apiKey = key;

    next();
  } catch (error) {
    console.error('API authentication error:', error);
    res.status(500).json({ message: 'Error authenticating API key' });
  }
}; 
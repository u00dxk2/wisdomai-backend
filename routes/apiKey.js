/**
 * @fileoverview API key management routes for the WisdomAI API.
 * Handles creation, retrieval, and revocation of API keys for authenticated users.
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import ApiKey from '../models/ApiKey.js';
import { validate } from '../middleware/validator.js';
import { body } from 'express-validator';

const router = express.Router();

/**
 * Validation rules for API key creation
 * @type {Array<Object>}
 */
const createKeyValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Key name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Key name must be between 1 and 50 characters'),
  body('expiresIn')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Expiration days must be between 1 and 365')
];

/**
 * @swagger
 * /api/keys:
 *   post:
 *     tags:
 *       - API Keys
 *     summary: Create a new API key
 *     description: Generate a new API key with optional expiration
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name/description for the API key (1-50 chars)
 *                 example: "Development Key"
 *               expiresIn:
 *                 type: integer
 *                 description: Number of days until key expiration (1-365)
 *                 default: 30
 *                 minimum: 1
 *                 maximum: 365
 *                 example: 30
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "API key created successfully"
 *                 key:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Unique identifier for the key
 *                     name:
 *                       type: string
 *                       description: Name/description of the key
 *                     key:
 *                       type: string
 *                       description: The actual API key (only shown once)
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: Expiration date of the key
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', [protect, validate(createKeyValidator)], async (req, res) => {
  try {
    const { name, expiresIn = 30 } = req.body;
    
    // Generate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    // Generate API key
    const keyString = ApiKey.generateKey();
    
    // Create new API key
    const apiKey = new ApiKey({
      user: req.user._id,
      key: keyString, // This will be hashed before saving
      name,
      expiresAt
    });

    await apiKey.save();

    // Return the unhashed key (this is the only time it will be available)
    res.status(201).json({
      message: 'API key created successfully',
      key: {
        id: apiKey._id,
        name: apiKey.name,
        key: keyString, // Unhashed version
        expiresAt: apiKey.expiresAt
      }
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ message: 'Error creating API key' });
  }
});

/**
 * Get all active API keys for the authenticated user
 * 
 * @route GET /api/keys
 * @description Retrieve all active API keys for the current user
 * @access Private - Requires valid JWT token
 * 
 * @returns {Object} 200 - List of API keys
 * @returns {Array<Object>} keys - Array of API key objects
 * @returns {string} keys[].id - Unique identifier for the key
 * @returns {string} keys[].name - Name/description of the key
 * @returns {Date} keys[].expiresAt - Expiration date of the key
 * @returns {Date} keys[].lastUsed - Last usage timestamp
 * @returns {number} keys[].usageCount - Total number of times used
 * @returns {boolean} keys[].isExpired - Whether the key has expired
 * 
 * @throws {Object} 401 - Unauthorized
 * @throws {Object} 500 - Server error
 */
router.get('/', protect, async (req, res) => {
  try {
    const keys = await ApiKey.find({ 
      user: req.user._id,
      isActive: true 
    }).select('-key'); // Don't send hashed keys

    res.json({
      keys: keys.map(key => ({
        id: key._id,
        name: key.name,
        expiresAt: key.expiresAt,
        lastUsed: key.lastUsed,
        usageCount: key.usageCount,
        isExpired: key.isExpired()
      }))
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ message: 'Error fetching API keys' });
  }
});

/**
 * @swagger
 * /api/keys/{id}:
 *   delete:
 *     tags:
 *       - API Keys
 *     summary: Revoke an API key
 *     description: Deactivate an API key by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the API key to revoke
 *     responses:
 *       200:
 *         description: API key revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "API key revoked successfully"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: API key not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const key = await ApiKey.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!key) {
      return res.status(404).json({ message: 'API key not found' });
    }

    key.isActive = false;
    await key.save();

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ message: 'Error revoking API key' });
  }
});

export default router; 
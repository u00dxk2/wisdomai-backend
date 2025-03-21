import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { validate } from '../middleware/validator.js';
import { registerValidator, loginValidator, updateProfileValidator } from '../validators/auth.validator.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user account
 *     description: Create a new user account with username, email, and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username (2-50 chars, alphanumeric and spaces only)
 *                 example: "john_doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Valid email address
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Password (min 8 chars, must contain letter and number)
 *                 example: "Password123"
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: User ID
 *                     username:
 *                       type: string
 *                       description: Username
 *                     email:
 *                       type: string
 *                       description: Email address
 *                     isPremium:
 *                       type: boolean
 *                       description: Premium user status
 *       400:
 *         description: Validation error / User already exists
 *       500:
 *         description: Server error
 */
router.post(
  '/register',
  validate(registerValidator),
  async (req, res) => {
    const { username, email, password } = req.body;

    try {
      console.log('Registration attempt:', { username, email });

      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        console.log('Registration failed: Email already exists');
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Check if username is taken
      user = await User.findOne({ username });
      if (user) {
        console.log('Registration failed: Username already taken');
        return res.status(400).json({ message: 'Username is already taken' });
      }

      // Create user
      user = new User({
        username,
        email,
        password,
      });

      await user.save();
      console.log('User created successfully:', { id: user._id, username: user.username });

      // Create JWT token
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isPremium: user.isPremium,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: Object.values(error.errors).map(err => err.message).join(', ') });
      }
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Username or email is already taken' });
      }
      res.status(500).json({ message: 'Server error during registration' });
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login to user account
 *     description: Authenticate user and get JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *                 example: "Password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: User ID
 *                     username:
 *                       type: string
 *                       description: Username
 *                     email:
 *                       type: string
 *                       description: Email address
 *                     isPremium:
 *                       type: boolean
 *                       description: Premium user status
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post(
  '/login',
  validate(loginValidator),
  async (req, res) => {
    const { email, password } = req.body;

    try {
      // Check if user exists
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Create JWT token
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isPremium: user.isPremium,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route PUT /api/auth/profile
 * @description Update user profile information
 * @access Private - Requires valid JWT token
 * 
 * @param {Object} req.body
 * @param {string} [req.body.username] - New username (2-50 chars, alphanumeric and spaces only)
 * @param {string} [req.body.email] - New email address
 * @param {string} [req.body.currentPassword] - Current password (required for password change)
 * @param {string} [req.body.newPassword] - New password (min 8 chars, must contain letter and number)
 * 
 * @returns {Object} 200 - Profile updated successfully
 * @returns {Object} user - Updated user details (id, username, email, isPremium)
 * 
 * @throws {Object} 400 - Validation error / Invalid current password
 * @throws {Object} 401 - Unauthorized
 * @throws {Object} 404 - User not found
 * @throws {Object} 500 - Server error
 */
router.put(
  '/profile',
  [protect, validate(updateProfileValidator)],
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select('+password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Update fields if provided
      if (req.body.name) user.username = req.body.name;
      if (req.body.email) user.email = req.body.email;
      
      // If updating password
      if (req.body.currentPassword && req.body.newPassword) {
        const isMatch = await user.matchPassword(req.body.currentPassword);
        if (!isMatch) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }
        user.password = req.body.newPassword;
      }

      await user.save();

      res.json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isPremium: user.isPremium,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route GET /api/auth/validate
 * @description Validate JWT token
 * @access Private - Requires valid JWT token
 * 
 * @returns {Object} 200 - Token is valid
 * @returns {boolean} valid - Always true if token is valid
 * 
 * @throws {Object} 401 - Invalid/expired token
 */
router.get('/validate', protect, (req, res) => {
  res.json({ valid: true });
});

export default router; 
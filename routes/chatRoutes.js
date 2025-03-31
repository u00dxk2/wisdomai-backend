const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const chatController = require('../controllers/chatController');

/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     tags: [Chat]
 *     summary: Save a chat message
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chatId:
 *                 type: string
 *                 description: Optional chat ID for existing chat
 *               message:
 *                 type: object
 *                 properties:
 *                   role:
 *                     type: string
 *                     enum: [user, assistant]
 *                   content:
 *                     type: string
 *     responses:
 *       200:
 *         description: Message saved successfully
 */
router.post('/message', auth, chatController.saveMessage);

/**
 * @swagger
 * /api/chat/history:
 *   get:
 *     tags: [Chat]
 *     summary: Get user's chat history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's chats
 */
router.get('/history', auth, chatController.getChatHistory);

/**
 * @swagger
 * /api/chat/clear:
 *   post:
 *     tags: [Chat]
 *     summary: Clear all messages from a chat
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chatId:
 *                 type: string
 *                 description: ID of the chat to clear
 *                 required: true
 *     responses:
 *       200:
 *         description: Chat cleared successfully
 *       400:
 *         description: Chat ID is required
 *       404:
 *         description: Chat not found
 */
router.post('/clear', auth, chatController.clearChat);

/**
 * @swagger
 * /api/chat/{chatId}:
 *   get:
 *     tags: [Chat]
 *     summary: Get messages for a specific chat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat messages retrieved successfully
 */
router.get('/:chatId', auth, chatController.getChatMessages);

/**
 * @swagger
 * /api/chat/{chatId}:
 *   delete:
 *     tags: [Chat]
 *     summary: Delete a chat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat deleted successfully
 */
router.delete('/:chatId', auth, chatController.deleteChat);

module.exports = router; 
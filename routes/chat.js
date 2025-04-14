const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createChat,
  getUserChats,
  getChatMessages,
  getUnreadCount,
  updateMessage,
  deleteMessage,
  sendMessage
} = require('../controllers/chatController');

// Create a new chat
router.post('/', protect, createChat);

// Get all chats for current user
router.get('/', protect, getUserChats);

// Get messages for a specific chat
router.get('/:chatId/messages', protect, getChatMessages);

// Get total unread messages count
router.get('/unread', protect, getUnreadCount);

// Send a new message
router.post('/messages', protect, sendMessage);

// Edit a message
router.put('/:chatId/messages/:messageId', protect, updateMessage);

// Delete a message
router.delete('/:chatId/messages/:messageId', protect, deleteMessage);

module.exports = router;
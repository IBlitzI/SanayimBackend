const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { chatWithGemini, deleteHistory } = require('../controllers/geminiController');

router.post('/chat', protect, chatWithGemini);

// Sohbet geçmişini silme endpoint'i
router.delete('/history', protect, deleteHistory);

module.exports = router;

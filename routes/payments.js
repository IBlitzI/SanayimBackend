const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { 
  createPayment, 
  updatePaymentStatus 
} = require('../controllers/paymentController');

router.post('/', protect, createPayment);
router.patch('/:id/status', protect, updatePaymentStatus);

module.exports = router;

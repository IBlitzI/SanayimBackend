const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  repairListingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RepairListing',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mechanicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'cash'],
    required: true
  },
  transactionId: {
    type: String,
    sparse: true 
  },
  receiptUrl: {
    type: String,
    sparse: true
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
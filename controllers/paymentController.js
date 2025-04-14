const Payment = require('../models/Payment');
const RepairListing = require('../models/RepairListing');

exports.createPayment = async (req, res) => {
  try {
    const { repairListingId, mechanicId, amount, paymentMethod, notes } = req.body;
    
    const listing = await RepairListing.findById(repairListingId);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const payment = new Payment({
      repairListingId,
      customerId: req.user._id,
      mechanicId,
      amount,
      paymentMethod,
      notes,
      status: 'pending'
    });
    
    await payment.save();
    res.status(201).json(payment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status, transactionId, receiptUrl } = req.body;
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    
    payment.status = status;
    if (transactionId) payment.transactionId = transactionId;
    if (receiptUrl) payment.receiptUrl = receiptUrl;
    
    await payment.save();
    res.json(payment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

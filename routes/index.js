const express = require('express');
const router = express.Router();

const userRoutes = require('./users');
const repairListingRoutes = require('./repairListings');
const paymentRoutes = require('./payments');
const geminiRoutes = require('./gemini');
const chatRoutes = require('./chat');
const reviewRoutes = require('./reviews');

router.use('/users', userRoutes);
router.use('/repair-listings', repairListingRoutes);
router.use('/payments', paymentRoutes);
router.use('/gemini', geminiRoutes);
router.use('/chat', chatRoutes);
router.use('/reviews', reviewRoutes);

module.exports = router;

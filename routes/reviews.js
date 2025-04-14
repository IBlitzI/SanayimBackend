const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createReview,
  getMechanicReviews,
  updateReview,
  deleteReview,
  getUserReviews,
  mechanicDeleteReview
} = require('../controllers/reviewController');

// Create a review for a mechanic (only vehicle owners)
router.post('/mechanic', protect, authorize('vehicle_owner'), createReview);

// Get all reviews for a mechanic (public)
router.get('/mechanic/:mechanicId', getMechanicReviews);

// Get reviews for authenticated user (protected)
router.get('/me', protect, getUserReviews);

// Update own review (only vehicle owners)
router.put('/mechanic/:mechanicId', protect, authorize('vehicle_owner'), updateReview);

// Delete own review (only vehicle owners)
router.delete('/mechanic/:mechanicId', protect, authorize('vehicle_owner'), deleteReview);

// Mechanic can delete review comments about themselves (only mechanics)
router.delete('/mechanic/review/:reviewId', protect, authorize('mechanic'), mechanicDeleteReview);

module.exports = router;
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { 
  createListing, 
  getListings, 
  submitBid, 
  selectBid,
  getMechanicsByLocation,
  getUserListings,
  getListingById,
  getMechanicBids,
  completeListing
} = require('../controllers/repairListingController');

// Get all listings with optional status and location filters
router.post('/get-listings', protect, getListings);

// Get logged-in user's repair listings
router.get('/me', protect, getUserListings);

// Get mechanics bids on repair listings
router.get('/mechanic-bids', protect, authorize('mechanic'), getMechanicBids);

// Get specific repair listing by ID
router.get('/:id', protect, getListingById);

// Create a new repair listing
router.post('/', protect, authorize('vehicle_owner'), createListing);

// Submit a bid on a repair listing
router.post('/:id/bids', protect, authorize('mechanic'), submitBid);

// Select a winning bid
router.post('/select-bid', protect, authorize('vehicle_owner'), selectBid);

// Get mechanics by location (only for vehicle owners)
router.post('/mechanics', protect, authorize('vehicle_owner'), getMechanicsByLocation);

// Complete a repair listing (only for mechanics with the selected bid)
router.post('/complete', protect, authorize('mechanic'), completeListing);

module.exports = router;

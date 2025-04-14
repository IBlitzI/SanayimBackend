const User = require('../models/User');

// Create a new review
exports.createReview = async (req, res) => {
  try {
    const { rating, comment, mechanicId } = req.body;

    // Validate inputs
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required'
      });
    }

    // Check if user is a vehicle owner
    if (req.user.userType !== 'vehicle_owner') {
      return res.status(403).json({
        success: false,
        message: 'Only vehicle owners can leave reviews'
      });
    }

    // Find mechanic
    const mechanic = await User.findById(mechanicId);
    if (!mechanic || mechanic.userType !== 'mechanic') {
      return res.status(404).json({
        success: false,
        message: 'Mechanic not found'
      });
    }

    // Check if user has already reviewed this mechanic
    const existingReview = mechanic.reviews.find(
      review => review.reviewerId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this mechanic'
      });
    }

    // Create new review
    const review = {
      reviewerId: req.user._id,
      reviewerName: req.user.fullName,
      rating,
      comment,
      createdAt: new Date()
    };

    // Add review to mechanic's reviews
    mechanic.reviews.push(review);
    await mechanic.save();

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get reviews for a mechanic
exports.getMechanicReviews = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const mechanic = await User.findById(mechanicId)
      .select('reviews rating reviewCount')
      .populate('reviews.reviewerId', 'fullName profileImage');

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Mechanic not found'
      });
    }

    res.json({
      success: true,
      data: {
        reviews: mechanic.reviews,
        rating: mechanic.rating,
        reviewCount: mechanic.reviewCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get reviews for the authenticated user
exports.getUserReviews = async (req, res) => {
  try {
    const userId = req.user._id;
    const mechanic = await User.findById(userId)
      .select('reviews rating reviewCount')
      .populate('reviews.reviewerId', 'fullName profileImage');

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        reviews: mechanic.reviews,
        rating: mechanic.rating,
        reviewCount: mechanic.reviewCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update a review
exports.updateReview = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const { rating, comment } = req.body;

    // Validate inputs
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required'
      });
    }

    // Find mechanic
    const mechanic = await User.findById(mechanicId);
    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Mechanic not found'
      });
    }

    // Find the review
    const review = mechanic.reviews.find(
      review => review.reviewerId.toString() === req.user._id.toString()
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update review
    review.rating = rating;
    review.comment = comment;
    await mechanic.save();

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete a review
exports.deleteReview = async (req, res) => {
  try {
    const { mechanicId } = req.params;

    // Find mechanic
    const mechanic = await User.findById(mechanicId);
    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Mechanic not found'
      });
    }

    // Find and remove the review
    const reviewIndex = mechanic.reviews.findIndex(
      review => review.reviewerId.toString() === req.user._id.toString()
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    mechanic.reviews.splice(reviewIndex, 1);
    await mechanic.save();

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete a review as mechanic (soft delete - only hides comment)
exports.mechanicDeleteReview = async (req, res) => {
  try {
    const mechanicId = req.user._id; // Logged in mechanic's ID
    const { reviewId } = req.params;

    // Find mechanic
    const mechanic = await User.findById(mechanicId);
    if (!mechanic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mechanic not found' 
      });
    }

    // Find the review
    const review = mechanic.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review not found' 
      });
    }

    // Just update the comment to indicate it was removed by mechanic
    // Keep the rating for average calculation
    review.comment = '[Usta tarafından kaldırıldı]';
    review.deletedByMechanic = true;
    await mechanic.save();

    res.json({
      success: true,
      message: 'Review comment removed successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
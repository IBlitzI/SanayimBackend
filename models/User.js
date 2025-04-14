const mongoose = require('mongoose');
const { validateTCKimlikNo, validateLicensePlate,validateSpecialty, getValidSpecialties } = require('../utils/validators');

const reviewSchema = new mongoose.Schema({
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewerName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true
  },
  deletedByMechanic: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['vehicle_owner', 'mechanic'],
    required: true
  },
  tcKimlikNo: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: validateTCKimlikNo,
      message: 'Geçersiz TC Kimlik Numarası'
    }
  },
  licensePlate: {
    type: String,
    trim: true,
    sparse: true, // vehicle_owner için gerekli
    validate: {
      validator: validateLicensePlate,
      message: 'Geçersiz plaka formatı. Örnek format: 34ABC123'
    },
    uppercase: true // Plakaları otomatik büyük harfe çevirir
  },
  location: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  specialties: [{
    type: String,
    trim: true
  }],
  reviews: [reviewSchema],
  reviewCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate average rating when a review is added
userSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating = totalRating / this.reviews.length;
    this.reviewCount = this.reviews.length;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
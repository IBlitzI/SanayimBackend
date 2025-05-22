const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const userController = require('../controllers/userController');
const { validateTCKimlikNo } = require('../utils/validators');

// Auth routes
router.post('/register', [
  body('fullName').notEmpty().withMessage('Full Name is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('tcKimlikNo').custom((value) => {
    if (!validateTCKimlikNo(value)) {
      throw new Error('Invalid TC Kimlik No');
    }
    return true;
  }),
  body('licensePlate').notEmpty().withMessage('Vehicle License Plate is required'),
  body('userType').isIn(['vehicle_owner', 'mechanic'])
], userController.register);

router.post('/login', userController.login);

router.post('/logout', protect, userController.logout);

// Protected routes
router.get('/profile', protect, userController.getProfile);

// Update profile route now handles multipart/form-data
router.put('/profile', protect, userController.updateProfile);

// Update push token
router.post('/push-token', protect, userController.updatePushToken);

module.exports = router;

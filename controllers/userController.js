const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
});

exports.register = [
  upload.single('profileImage'),
  async (req, res) => {
    try {
      const { email, password, fullName, userType, tcKimlikNo, licensePlate,location } = req.body;
      
      const userExists = await User.findOne({ 
        $or: [
          { email },
          { tcKimlikNo }
        ]
      });
      
      if (userExists) {
        // Clean up uploaded file if it exists
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        }
        return res.status(400).json({ 
          message: userExists.email === email ? 'Email already exists' : 'TC Kimlik No already exists' 
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userData = {
        fullName,
        email,
        password: hashedPassword,
        userType,
        tcKimlikNo,
        licensePlate,
        location
      };

      // If file was uploaded, convert to base64 and add to userData
      if (req.file) {
        const imageBuffer = fs.readFileSync(req.file.path);
        userData.profileImage = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
        
        // Delete the uploaded file since we now have it in base64
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }

      const user = new User(userData);
      await user.save();
      
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
      });

      res.status(201).json({ 
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          userType: user.userType,
          tcKimlikNo: user.tcKimlikNo,
          licensePlate: user.licensePlate,
          profileImage: user.profileImage,
          location: user.location
        }
      });
    } catch (error) {
      // If there was an error and we uploaded a file, clean it up
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      res.status(500).json({ message: error.message });
    }
  }
];

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.json({ 
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = [
  upload.single('profileImage'),
  async (req, res) => {
    try {
      const updates = JSON.parse(JSON.stringify(req.body)); // Convert form data to object
      delete updates.password;

      // If file was uploaded, convert to base64 and add to updates
      if (req.file) {
        const imageBuffer = fs.readFileSync(req.file.path);
        updates.profileImage = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
        
        // Delete the uploaded file since we now have it in base64
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      // If there was an error and we uploaded a file, clean it up
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }
  }
];

exports.logout = async (req, res) => {
  try {
    // In a token-based authentication system, the client-side should handle token removal
    // Server-side we just send a successful response
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Update push token
exports.updatePushToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        message: 'Expo push token gereklidir'
      });
    }

    // Update the user's push token
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { expoPushToken },
      { new: true, select: '-password' }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    res.json({
      success: true,
      message: 'Push token başarıyla güncellendi',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('Push token güncelleme hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

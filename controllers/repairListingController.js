const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: fileFilter
});

const RepairListing = require('../models/RepairListing');

exports.createListing = [
  upload.array('files', 5), // Allow up to 5 files
  async (req, res) => {
    try {
      const { description, location } = req.body;
      const files = req.files;
      
      if (!description || !location || !files || files.length === 0) {
        // Clean up any uploaded files if validation fails
        if (files) {
          files.forEach(file => {
            fs.unlink(file.path, (err) => {
              if (err) console.error('Error deleting file:', err);
            });
          });
        }
        return res.status(400).json({ 
          message: 'Please provide description, location, and at least one image or video file'
        });
      }

      // Convert files to base64 and add file type
      const mediaFiles = await Promise.all(files.map(async (file) => {
        const fileBuffer = fs.readFileSync(file.path);
        const base64File = `data:${file.mimetype};base64,${fileBuffer.toString('base64')}`;
        
        // Clean up the file after converting to base64
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
        
        return {
          data: base64File,
          type: file.mimetype.startsWith('image/') ? 'image' : 'video'
        };
      }));

      const listing = new RepairListing({
        description,
        mediaFiles, // Store both images and videos with their types
        location,
        ownerId: req.user._id,
        ownerName: req.user.fullName,
        vehicleLicensePlate: req.user.licensePlate,
        status: 'open'
      });

      await listing.save();
      res.status(201).json(listing);
    } catch (error) {
      // Clean up any uploaded files if an error occurs
      if (req.files) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
      res.status(400).json({ message: error.message });
    }
  }
];

exports.getListings = async (req, res) => {
  try {
    const { location } = req.body;
    
    if (!location) {
      return res.status(400).json({ message: 'Location is required' });
    }

    const listings = await RepairListing.find({ location })
      .sort({ createdAt: -1 })
      .populate('ownerId', 'fullName profileImage');
      
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.submitBid = async (req, res) => {
  try {
    const { amount, estimatedTime, message } = req.body;
    const listing = await RepairListing.findById(req.params.id);
    
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (req.user.userType !== 'mechanic') {
      return res.status(403).json({ message: 'Only mechanics can submit bids' });
    }

    const newBid = {
      mechanicId: req.user._id,
      mechanicName: req.user.fullName,
      amount,
      estimatedTime,
      message
    };

    listing.bids.push(newBid);
    await listing.save();
    res.json(listing);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.selectBid = async (req, res) => {
  try {
    const listing = await RepairListing.findById(req.params.listingId);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    if (listing.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    listing.selectedBidId = req.params.bidId;
    listing.status = 'assigned';
    await listing.save();

    res.json(listing);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getMechanicsByLocation = async (req, res) => {
  try {
    const { location } = req.body;
    
    if (!location) {
      return res.status(400).json({ message: 'Location is required' });
    }

    // Check if user is a vehicle owner
    if (req.user.userType !== 'vehicle_owner') {
      return res.status(403).json({ message: 'Only vehicle owners can search for mechanics' });
    }

    const mechanics = await User.find({
      userType: 'mechanic',
      location: location
    })

    res.json({
      success: true,
      data: mechanics
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.getUserListings = async (req, res) => {
  try {
    const listings = await RepairListing.find({ ownerId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('ownerId', 'fullName profileImage');
      
    res.json({
      success: true,
      data: listings
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.getListingById = async (req, res) => {
  try {
    const listing = await RepairListing.findById(req.params.id)
      .populate('ownerId', 'fullName profileImage')
      .populate('bids.mechanicId', 'fullName profileImage location specialties');
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Repair listing not found'
      });
    }

    res.json({
      success: true,
      data: listing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

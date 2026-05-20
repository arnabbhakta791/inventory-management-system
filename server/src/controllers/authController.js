const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

// Generate slug from tenant name
const generateSlug = (name) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// Sign JWT
const signToken = (userId, tenantId, role) =>
  jwt.sign({ userId, tenantId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

// @desc    Register new tenant + owner account
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { tenantName, name, email, password } = req.body;

    // Generate a unique slug
    let slug = generateSlug(tenantName);
    const existing = await Tenant.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    // Create tenant
    const tenant = await Tenant.create({ name: tenantName, slug });

    // Create owner user
    const user = await User.create({ tenantId: tenant._id, name, email, password, role: 'owner' });

    const token = signToken(user._id, tenant._id, user.role);

    res.status(201).json({
      success: true,
      token,
      user,
      tenant,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user (must be active)
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant || !tenant.isActive) {
      return res.status(403).json({ success: false, message: 'Tenant account is inactive' });
    }

    const token = signToken(user._id, tenant._id, user.role);

    res.json({ success: true, token, user, tenant });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    const tenant = await Tenant.findById(req.tenantId);
    res.json({ success: true, user, tenant });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe };

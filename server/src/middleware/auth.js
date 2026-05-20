const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// Verify JWT and attach user info to request
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Cast to ObjectId so both Model.find() and Model.aggregate() $match
    // queries work correctly — JWT serialises ObjectIds as plain strings,
    // and aggregate() pipelines do NOT auto-cast strings to ObjectId.
    req.userId   = new mongoose.Types.ObjectId(decoded.userId);
    req.tenantId = new mongoose.Types.ObjectId(decoded.tenantId);
    req.userRole = decoded.role;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized — invalid token' });
  }
};

module.exports = { protect };

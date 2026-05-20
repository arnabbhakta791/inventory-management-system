const jwt = require('jsonwebtoken');
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

    // Attach IDs — every middleware and controller can use req.tenantId
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized — invalid token' });
  }
};

module.exports = { protect };

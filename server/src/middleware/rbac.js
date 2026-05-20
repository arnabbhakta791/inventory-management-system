// Role hierarchy: owner > manager > staff
const ROLE_HIERARCHY = { owner: 3, manager: 2, staff: 1 };

// Middleware factory — requires one of the specified roles
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const userLevel = ROLE_HIERARCHY[req.userRole] || 0;
    const hasPermission = roles.some((role) => ROLE_HIERARCHY[role] <= userLevel);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
};

// Shorthand helpers
const ownerOnly = requireRole('owner');
const managerOrAbove = requireRole('manager', 'owner');

module.exports = { requireRole, ownerOnly, managerOrAbove };

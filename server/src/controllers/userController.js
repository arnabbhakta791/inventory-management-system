const User = require('../models/User');

// @desc    List all users in tenant
// @route   GET /api/users
// @access  Private — manager/owner
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
};

// @desc    Create/invite a new user in tenant
// @route   POST /api/users
// @access  Private — owner only
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await User.create({
      tenantId: req.tenantId,
      name, email, password,
      role: role || 'staff',
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
};

// @desc    Update user role or active status
// @route   PATCH /api/users/:id
// @access  Private — owner only
const updateUser = async (req, res, next) => {
  try {
    // Prevent owner from demoting themselves
    if (req.params.id === req.userId.toString() && req.body.role && req.body.role !== 'owner') {
      return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    }
    delete req.body.password; // never update password via this endpoint
    delete req.body.tenantId;
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// @desc    Deactivate a user
// @route   DELETE /api/users/:id
// @access  Private — owner only
const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.userId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate yourself' });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { isActive: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) { next(err); }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };

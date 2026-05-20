const { validationResult } = require('express-validator');
const Supplier = require('../models/Supplier');

// @desc    Get all suppliers (paginated)
// @route   GET /api/suppliers
// @access  Private
const getSuppliers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isActive = 'true' } = req.query;

    const query = { tenantId: req.tenantId };
    if (isActive !== 'all') query.isActive = isActive === 'true';
    if (search) query.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Supplier.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: suppliers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// @access  Private
const getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).populate('products.productId', 'name category variants');

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

// @desc    Create supplier
// @route   POST /api/suppliers
// @access  Private — manager/owner
const createSupplier = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const supplier = await Supplier.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private — manager/owner
const updateSupplier = async (req, res, next) => {
  try {
    delete req.body.tenantId; // never allow overriding tenantId

    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

// @desc    Soft-delete supplier
// @route   DELETE /api/suppliers/:id
// @access  Private — manager/owner
const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.json({ success: true, message: 'Supplier deactivated' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier };

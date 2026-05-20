const { validationResult } = require('express-validator');
const Product = require('../models/Product');
const { getSmartLowStockAlerts } = require('../services/alertService');

// @desc    Get all products (paginated, filtered)
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      supplierId,
      search,
      lowStock,
      isActive = 'true',
    } = req.query;

    const query = { tenantId: req.tenantId };
    if (isActive !== 'all') query.isActive = isActive === 'true';
    if (category) query.category = category;
    if (supplierId) query.supplierId = supplierId;
    if (search) query.$text = { $search: search };
    if (lowStock === 'true') {
      // Any variant below its threshold
      query['variants'] = {
        $elemMatch: {
          $expr: { $lt: ['$stock', '$lowStockThreshold'] },
        },
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('supplierId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('supplierId', 'name email phone');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product with variants
// @route   POST /api/products
// @access  Private — manager/owner
const createProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const product = await Product.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private — manager/owner
const updateProduct = async (req, res, next) => {
  try {
    // Never allow changing tenantId
    delete req.body.tenantId;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Soft delete product
// @route   DELETE /api/products/:id
// @access  Private — manager/owner
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deactivated' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get smart low-stock items (PO-aware)
// @route   GET /api/products/low-stock
// @access  Private
const getLowStock = async (req, res, next) => {
  try {
    const alerts = await getSmartLowStockAlerts(req.tenantId);
    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all unique categories for this tenant
// @route   GET /api/products/categories
// @access  Private
const getCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct('category', { tenantId: req.tenantId, isActive: true });
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual stock adjustment for a variant
// @route   PATCH /api/products/:id/variants/:sku/stock
// @access  Private — manager/owner
const adjustVariantStock = async (req, res, next) => {
  try {
    const { adjustment, notes } = req.body; // adjustment can be positive or negative
    if (typeof adjustment !== 'number') {
      return res.status(400).json({ success: false, message: 'adjustment must be a number' });
    }

    const product = await Product.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const variant = product.variants.find((v) => v.sku === req.params.sku);
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });

    const previousStock = variant.stock;
    const newStock = previousStock + adjustment;
    if (newStock < 0) {
      return res.status(400).json({ success: false, message: 'Stock cannot go below 0' });
    }

    // Use atomic update to prevent race conditions
    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, 'variants.sku': req.params.sku },
      { $inc: { 'variants.$.stock': adjustment } },
      { new: true }
    );

    // Log the stock movement (imported lazily to avoid circular deps)
    const StockMovement = require('../models/StockMovement');
    await StockMovement.create({
      tenantId: req.tenantId,
      productId: product._id,
      variantSku: req.params.sku,
      type: 'adjustment',
      quantity: adjustment,
      previousStock,
      newStock,
      notes: notes || 'Manual adjustment',
      performedBy: req.userId,
    });

    // Emit real-time event
    const { emitToTenant } = require('../socket');
    emitToTenant(req.tenantId.toString(), 'stock:updated', {
      productId: product._id,
      sku: req.params.sku,
      newStock,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStock,
  getCategories,
  adjustVariantStock,
};

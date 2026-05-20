const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');

// @desc    Get stock movements (filtered, paginated)
// @route   GET /api/stock-movements
// @access  Private
const getStockMovements = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 30,
      productId,
      variantSku,
      type,
      dateFrom,
      dateTo,
    } = req.query;

    const query = { tenantId: req.tenantId };
    if (productId) query.productId = productId;
    if (variantSku) query.variantSku = variantSku;
    if (type) query.type = type;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [movements, total] = await Promise.all([
      StockMovement.find(query)
        .populate('productId', 'name category')
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockMovement.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: movements,
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

// @desc    Get stock movement summary for a specific product variant
// @route   GET /api/stock-movements/product/:productId/variant/:sku
// @access  Private
const getVariantHistory = async (req, res, next) => {
  try {
    const { productId, sku } = req.params;
    const { limit = 50 } = req.query;

    const movements = await StockMovement.find({
      tenantId: req.tenantId,
      productId,
      variantSku: sku,
    })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Get current stock for this variant
    const product = await Product.findOne(
      { _id: productId, tenantId: req.tenantId, 'variants.sku': sku },
      { 'variants.$': 1, name: 1 }
    ).lean();

    const currentStock = product?.variants?.[0]?.stock ?? null;

    res.json({
      success: true,
      productName: product?.name,
      variantSku: sku,
      currentStock,
      data: movements,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStockMovements, getVariantHistory };

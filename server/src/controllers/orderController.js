const { validationResult } = require('express-validator');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const Tenant  = require('../models/Tenant');
const { deductStock, addStock, InsufficientStockError } = require('../services/stockService');

// Valid forward-only transitions
const ALLOWED_TRANSITIONS = {
  pending:              ['confirmed', 'cancelled'],
  confirmed:            ['shipped',   'cancelled'],
  shipped:              ['delivered', 'cancelled'],
  delivered:            [],
  cancelled:            [],
  partially_fulfilled:  ['cancelled'],
};

// Generate order number: ORD-{SLUG}-{YYMMDD}-{RAND}
const generateOrderNumber = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).select('slug').lean();
  const slug   = (tenant?.slug || 'ord').toUpperCase().slice(0, 8);
  const date   = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand   = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${slug}-${date}-${rand}`;
};

// ─────────────────────────────────────────────
// @desc    List orders (paginated + filtered)
// @route   GET /api/orders
// @access  Private
// ─────────────────────────────────────────────
const getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search, dateFrom, dateTo } = req.query;

    const query = { tenantId: req.tenantId };
    if (status) query.status = status;
    if (search) query.customerName = { $regex: search, $options: 'i' };
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo)   query.createdAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────
// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
// ─────────────────────────────────────────────
const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name')
      .populate('items.productId', 'name category');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create order — atomically deducts stock (concurrency-safe)
// @route   POST /api/orders
// @access  Private
//
// HOW CONCURRENCY IS HANDLED:
//   stockService.deductStock() wraps all item deductions in a single MongoDB
//   transaction. For each item it runs:
//
//     findOneAndUpdate(
//       { "variants.sku": sku, "variants.$.stock": { $gte: quantity } },   // ← atomic guard
//       { $inc: { "variants.$.stock": -quantity } }
//     )
//
//   If two requests arrive simultaneously for the last unit:
//     • First request: matches (stock=1 >= 1), decrements → stock=0. ✓
//     • Second request: no match (stock=0 >= 1 is false) → throws
//       InsufficientStockError → transaction aborts → 409 returned.
//   Result: exactly one order succeeds, the rest get a clear error.
// ─────────────────────────────────────────────────────────────────────────────
const createOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { customerName, customerEmail, customerPhone, items, notes } = req.body;

    // ── 1. Enrich items: resolve product name + selling price from DB ──────
    const enrichedItems = [];
    for (const item of items) {
      const product = await Product.findOne(
        { _id: item.productId, tenantId: req.tenantId, isActive: true }
      ).lean();

      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.productId} not found` });
      }

      const variant = product.variants.find((v) => v.sku === item.variantSku);
      if (!variant) {
        return res.status(404).json({ success: false, message: `Variant ${item.variantSku} not found` });
      }

      enrichedItems.push({
        productId:   item.productId,
        variantSku:  item.variantSku,
        productName: product.name,
        quantity:    item.quantity,
        unitPrice:   item.unitPrice ?? variant.sellingPrice, // caller can override price
        fulfilledQuantity: 0,
      });
    }

    const orderNumber = await generateOrderNumber(req.tenantId);
    const totalAmount = enrichedItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    // ── 2. Atomically deduct stock (throws InsufficientStockError on failure) ──
    await deductStock(
      req.tenantId,
      enrichedItems.map(({ productId, variantSku, quantity }) => ({ productId, variantSku, quantity })),
      { type: 'sale', reference: orderNumber, performedBy: req.userId }
    );

    // ── 3. Only reaches here if ALL items were successfully deducted ──────────
    const order = await Order.create({
      tenantId:      req.tenantId,
      orderNumber,
      customerName,
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || '',
      status:        'pending',
      items:         enrichedItems,
      totalAmount,
      notes:         notes || '',
      createdBy:     req.userId,
      statusHistory: [{ status: 'pending', changedBy: req.userId }],
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    // Surface insufficient-stock as a clean 409 with details
    if (err instanceof InsufficientStockError) {
      return res.status(409).json({
        success: false,
        message: err.message,
        sku:       err.sku,
        available: err.available,
        requested: err.requested,
      });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private — manager/owner
// ─────────────────────────────────────────────────────────────────────────────
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, notes = '' } = req.body;

    const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${order.status}" to "${status}". Allowed: ${allowed.join(', ') || 'none'}`,
      });
    }

    // If moving to cancelled — release stock back
    if (status === 'cancelled') {
      const itemsToRelease = order.items
        .filter((i) => i.quantity > (i.fulfilledQuantity || 0))
        .map((i) => ({
          productId:  i.productId.toString(),
          variantSku: i.variantSku,
          quantity:   i.quantity - (i.fulfilledQuantity || 0),
        }));

      if (itemsToRelease.length > 0) {
        await addStock(req.tenantId, itemsToRelease, {
          type:        'return',
          reference:   order.orderNumber,
          referenceId: order._id,
          performedBy: req.userId,
        });
      }
    }

    const tsMap = { confirmed: 'confirmedAt', shipped: 'shippedAt', delivered: 'deliveredAt', cancelled: 'cancelledAt' };
    if (tsMap[status]) order[tsMap[status]] = new Date();

    order.status = status;
    order.updatedBy = req.userId;
    order.statusHistory.push({ status, changedBy: req.userId, notes });
    await order.save();

    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Cancel order (shortcut — same as status → cancelled)
// @route   POST /api/orders/:id/cancel
// @access  Private — manager/owner
// ─────────────────────────────────────────────────────────────────────────────
const cancelOrder = async (req, res, next) => {
  req.body.status = 'cancelled';
  return updateOrderStatus(req, res, next);
};

module.exports = { getOrders, getOrder, createOrder, updateOrderStatus, cancelOrder };

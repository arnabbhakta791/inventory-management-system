const { validationResult } = require('express-validator');
const PurchaseOrder = require('../models/PurchaseOrder');
const Tenant = require('../models/Tenant');
const { addStock } = require('../services/stockService');

// Valid status transitions (forward only)
const ALLOWED_TRANSITIONS = {
  draft:              ['sent', 'cancelled'],
  sent:               ['confirmed', 'cancelled'],
  confirmed:          ['cancelled'],          // receive handled separately
  partially_received: [],                      // only receive can move forward
  received:           [],
  cancelled:          [],
};

// Generate PO order number: PO-{slug}-{YYMMDD}-{4-char random}
const generateOrderNumber = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).select('slug').lean();
  const slug   = (tenant?.slug || 'po').toUpperCase().slice(0, 8);
  const date   = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand   = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PO-${slug}-${date}-${rand}`;
};

// @desc    List purchase orders
// @route   GET /api/purchase-orders
// @access  Private
const getPurchaseOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, supplierId, dateFrom, dateTo } = req.query;

    const query = { tenantId: req.tenantId };
    if (status)     query.status     = status;
    if (supplierId) query.supplierId = supplierId;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo)   query.createdAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('supplierId', 'name email phone')
        .populate('createdBy',  'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PurchaseOrder.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

// @desc    Get single PO
// @route   GET /api/purchase-orders/:id
// @access  Private
const getPurchaseOrder = async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('supplierId', 'name email phone contactPerson')
      .populate('createdBy',  'name email')
      .populate('updatedBy',  'name')
      .populate('items.productId', 'name category variants');

    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found' });
    res.json({ success: true, data: po });
  } catch (err) { next(err); }
};

// @desc    Create PO (always starts as draft)
// @route   POST /api/purchase-orders
// @access  Private — manager/owner
const createPurchaseOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const orderNumber = await generateOrderNumber(req.tenantId);
    const totalAmount = req.body.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice, 0
    );

    const po = await PurchaseOrder.create({
      ...req.body,
      tenantId: req.tenantId,
      orderNumber,
      totalAmount,
      status: 'draft',
      createdBy: req.userId,
      statusHistory: [{ status: 'draft', changedBy: req.userId }],
    });

    const populated = await po.populate('supplierId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

// @desc    Update PO (draft only)
// @route   PUT /api/purchase-orders/:id
// @access  Private — manager/owner
const updatePurchaseOrder = async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found' });
    if (po.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft purchase orders can be edited' });
    }

    delete req.body.tenantId;
    delete req.body.orderNumber;
    delete req.body.status;

    if (req.body.items) {
      req.body.totalAmount = req.body.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice, 0
      );
    }

    const updated = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.userId },
      { new: true, runValidators: true }
    ).populate('supplierId', 'name');

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// @desc    Transition PO status (draft→sent→confirmed, or cancel)
// @route   PATCH /api/purchase-orders/:id/status
// @access  Private — manager/owner
const updateStatus = async (req, res, next) => {
  try {
    const { status, notes = '' } = req.body;
    const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found' });

    const allowed = ALLOWED_TRANSITIONS[po.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${po.status}" to "${status}". Allowed: ${allowed.join(', ') || 'none'}`,
      });
    }

    // Timestamp fields
    const tsMap = { sent: 'sentAt', confirmed: 'confirmedAt' };
    const tsField = tsMap[status];

    po.status = status;
    po.updatedBy = req.userId;
    po.statusHistory.push({ status, changedBy: req.userId, notes });
    if (tsField) po[tsField] = new Date();

    await po.save();
    res.json({ success: true, data: po });
  } catch (err) { next(err); }
};

// @desc    Receive PO items (full or partial delivery)
// @route   POST /api/purchase-orders/:id/receive
// @access  Private — manager/owner
const receivePurchaseOrder = async (req, res, next) => {
  try {
    // Expected body: { items: [{ variantSku, receivedQuantity }], notes }
    const { items: receivedItems, notes = '' } = req.body;

    if (!receivedItems?.length) {
      return res.status(400).json({ success: false, message: 'Provide items to receive' });
    }

    const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found' });

    if (!['sent', 'confirmed', 'partially_received'].includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot receive items for a PO with status "${po.status}"`,
      });
    }

    // Validate received quantities and build stock-add payload
    const stockItems = [];
    for (const recv of receivedItems) {
      const poItem = po.items.find((i) => i.variantSku === recv.variantSku);
      if (!poItem) {
        return res.status(400).json({
          success: false,
          message: `SKU "${recv.variantSku}" not found in this PO`,
        });
      }

      const alreadyReceived = poItem.receivedQuantity || 0;
      const remaining       = poItem.quantity - alreadyReceived;

      if (recv.receivedQuantity <= 0) continue; // skip zero entries
      if (recv.receivedQuantity > remaining) {
        return res.status(400).json({
          success: false,
          message: `SKU "${recv.variantSku}": trying to receive ${recv.receivedQuantity} but only ${remaining} remaining`,
        });
      }

      stockItems.push({
        productId:  poItem.productId.toString(),
        variantSku: recv.variantSku,
        quantity:   recv.receivedQuantity,
      });
    }

    if (stockItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid quantities to receive' });
    }

    // Add stock atomically via stockService (single transaction)
    await addStock(req.tenantId, stockItems, {
      type:        'purchase',
      reference:   po.orderNumber,
      referenceId: po._id,
      performedBy: req.userId,
    });

    // Update receivedQuantity on each PO item
    for (const recv of receivedItems) {
      const poItem = po.items.find((i) => i.variantSku === recv.variantSku);
      if (poItem && recv.receivedQuantity > 0) {
        poItem.receivedQuantity = (poItem.receivedQuantity || 0) + recv.receivedQuantity;
        poItem.receivedAt       = new Date();
      }
    }

    // Determine new PO status
    const fullyReceived = po.items.every((i) => i.receivedQuantity >= i.quantity);
    po.status     = fullyReceived ? 'received' : 'partially_received';
    po.updatedBy  = req.userId;
    po.statusHistory.push({
      status:    po.status,
      changedBy: req.userId,
      notes:     notes || (fullyReceived ? 'All items received' : 'Partial delivery received'),
    });
    if (fullyReceived) po.receivedAt = new Date();

    await po.save();

    const populated = await po.populate([
      { path: 'supplierId', select: 'name' },
      { path: 'items.productId', select: 'name' },
    ]);

    res.json({ success: true, data: populated, fullyReceived });
  } catch (err) { next(err); }
};

// @desc    Cancel PO
// @route   DELETE /api/purchase-orders/:id
// @access  Private — manager/owner
const cancelPurchaseOrder = async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found' });

    if (!['draft', 'sent', 'confirmed'].includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a PO with status "${po.status}"`,
      });
    }

    po.status = 'cancelled';
    po.updatedBy = req.userId;
    po.statusHistory.push({ status: 'cancelled', changedBy: req.userId });
    await po.save();

    res.json({ success: true, message: 'Purchase order cancelled' });
  } catch (err) { next(err); }
};

module.exports = {
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  updatePurchaseOrder, updateStatus, receivePurchaseOrder, cancelPurchaseOrder,
};

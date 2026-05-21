/**
 * alertService.js — Smart Low-Stock Alerts
 * ==========================================
 *
 * Core rule:
 *   For each product variant where  stock < lowStockThreshold:
 *     filterQty      = sum of remaining qty across POs with status IN
 *                      ['sent','confirmed'] — used to decide whether to HIDE
 *                      the alert (stock is already on the way from supplier)
 *     displayQty     = sum of remaining qty across ALL non-terminal POs
 *                      (draft + sent + confirmed + partially_received) —
 *                      shown in the "Pending PO" column so users can see
 *                      any PO that exists, regardless of status
 *     effectiveStock = stock + filterQty
 *
 *   → ALERT only if effectiveStock < lowStockThreshold
 *   → SKIP  if a sent/confirmed PO will fully cover the gap  (no noise)
 *
 * Two separate maps are built so draft POs appear in the display column
 * without incorrectly suppressing alerts that aren't truly covered yet.
 */

const Product       = require('../models/Product');
const PurchaseOrder = require('../models/PurchaseOrder');
const { emitToTenant } = require('../socket');

// ─────────────────────────────────────────────────────────────────
// Build a lookup map:  `${productId}::${variantSku}` → remaining qty
// @param {ObjectId} tenantId
// @param {string[]} statuses — PO statuses to include
// ─────────────────────────────────────────────────────────────────
const buildPendingPOMap = async (tenantId, statuses = ['sent', 'confirmed']) => {
  const pendingPOs = await PurchaseOrder.find({
    tenantId,
    status: { $in: statuses },
  })
    .select('items')
    .lean();

  const map = {};
  for (const po of pendingPOs) {
    for (const item of po.items) {
      const remaining = item.quantity - (item.receivedQuantity || 0);
      if (remaining > 0) {
        const key = `${item.productId}::${item.variantSku}`;
        map[key] = (map[key] || 0) + remaining;
      }
    }
  }
  return map;
};

// All PO statuses that are not yet fully received or cancelled
const ALL_PENDING_STATUSES = ['draft', 'sent', 'confirmed', 'partially_received'];

// ─────────────────────────────────────────────────────────────────
// Main function — returns an array of alert objects.
// Called by: productController.getLowStock, dashboardController.getLowStockAlerts
// ─────────────────────────────────────────────────────────────────
const getSmartLowStockAlerts = async (tenantId) => {
  const [products, filterMap, displayMap] = await Promise.all([
    Product.find({ tenantId, isActive: true })
      .select('name category variants supplierId')
      .populate('supplierId', 'name')
      .lean(),
    // filterMap — sent/confirmed only: used to decide whether to suppress the alert
    buildPendingPOMap(tenantId, ['sent', 'confirmed']),
    // displayMap — all non-terminal statuses: shown in the "Pending PO" column
    buildPendingPOMap(tenantId, ALL_PENDING_STATUSES),
  ]);

  const alerts = [];

  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.stock >= variant.lowStockThreshold) continue; // healthy — skip

      const key          = `${product._id}::${variant.sku}`;
      const filterQty    = filterMap[key]  || 0; // sent/confirmed qty — for smart hide decision
      const displayQty   = displayMap[key] || 0; // all pending qty   — shown in column
      const effectiveStock = variant.stock + filterQty;

      if (effectiveStock >= variant.lowStockThreshold) continue; // sent/confirmed PO covers it — skip

      alerts.push({
        productId:      product._id,
        productName:    product.name,
        category:       product.category,
        supplier:       product.supplierId?.name || null,
        sku:            variant.sku,
        attributes:     variant.attributes || {},
        currentStock:   variant.stock,
        pendingPOQty:   displayQty,   // ← ALL pending POs (incl. draft) shown to user
        effectiveStock,
        threshold:      variant.lowStockThreshold,
        deficit:        variant.lowStockThreshold - effectiveStock,
        severity:       variant.stock === 0 ? 'critical' : 'warning',
      });
    }
  }

  // Sort: critical first, then by biggest deficit
  alerts.sort((a, b) => {
    if (a.severity !== b.severity)
      return a.severity === 'critical' ? -1 : 1;
    return b.deficit - a.deficit;
  });

  return alerts;
};

// ─────────────────────────────────────────────────────────────────
// Emit real-time alert to tenant room via Socket.io.
// Called after any stock deduction that might trigger a new alert.
// ─────────────────────────────────────────────────────────────────
const notifyLowStockIfNeeded = async (tenantId, productId, variantSku, newStock, threshold) => {
  if (newStock >= threshold) return; // still healthy — nothing to emit

  // Check if a pending PO covers the gap before firing the alert
  const pendingPOMap = await buildPendingPOMap(tenantId);
  const key          = `${productId}::${variantSku}`;
  const pendingQty   = pendingPOMap[key] || 0;
  const effectiveStock = newStock + pendingQty;

  if (effectiveStock >= threshold) return; // PO covers it — no noise

  emitToTenant(tenantId.toString(), 'stock:low', {
    productId,
    variantSku,
    currentStock:  newStock,
    pendingPOQty:  pendingQty,
    effectiveStock,
    threshold,
    severity: newStock === 0 ? 'critical' : 'warning',
  });
};

module.exports = { getSmartLowStockAlerts, notifyLowStockIfNeeded, buildPendingPOMap };

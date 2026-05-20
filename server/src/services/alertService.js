/**
 * alertService.js — Smart Low-Stock Alerts
 * ==========================================
 *
 * Core rule:
 *   For each product variant where  stock < lowStockThreshold:
 *     pendingQty    = sum of (quantity - receivedQuantity) across all PO items
 *                     with status IN ['sent','confirmed'] for this exact
 *                     (productId, variantSku) combination
 *     effectiveStock = stock + pendingQty
 *
 *   → ALERT only if effectiveStock < lowStockThreshold
 *   → SKIP  if a pending PO will fully cover the gap  (no noise)
 *
 * This prevents the common "false alarm" where a buyer already placed a
 * replenishment order but the stock hasn't physically arrived yet.
 */

const Product       = require('../models/Product');
const PurchaseOrder = require('../models/PurchaseOrder');
const { emitToTenant } = require('../socket');

// ─────────────────────────────────────────────────────────────────
// Build a lookup map:  variantSku → pending incoming quantity
// Scoped to one tenant; only considers 'sent' and 'confirmed' POs.
// ─────────────────────────────────────────────────────────────────
const buildPendingPOMap = async (tenantId) => {
  const pendingPOs = await PurchaseOrder.find({
    tenantId,
    status: { $in: ['sent', 'confirmed'] },
  })
    .select('items')
    .lean();

  const map = {}; // key: `${productId}::${variantSku}` → qty
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

// ─────────────────────────────────────────────────────────────────
// Main function — returns an array of alert objects.
// Called by: productController.getLowStock, dashboardController.getLowStockAlerts
// ─────────────────────────────────────────────────────────────────
const getSmartLowStockAlerts = async (tenantId) => {
  const [products, pendingPOMap] = await Promise.all([
    Product.find({ tenantId, isActive: true })
      .select('name category variants supplierId')
      .populate('supplierId', 'name')
      .lean(),
    buildPendingPOMap(tenantId),
  ]);

  const alerts = [];

  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.stock >= variant.lowStockThreshold) continue; // healthy — skip

      const key        = `${product._id}::${variant.sku}`;
      const pendingQty = pendingPOMap[key] || 0;
      const effectiveStock = variant.stock + pendingQty;

      if (effectiveStock >= variant.lowStockThreshold) continue; // PO covers the gap — skip

      alerts.push({
        productId:      product._id,
        productName:    product.name,
        category:       product.category,
        supplier:       product.supplierId?.name || null,
        sku:            variant.sku,
        attributes:     variant.attributes
          ? Object.fromEntries(variant.attributes)
          : {},
        currentStock:   variant.stock,
        pendingPOQty:   pendingQty,
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

const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { emitToTenant } = require('../socket');
// Lazy-require alertService to avoid circular dependency at module load time
const getAlertService = () => require('./alertService');

/**
 * Custom error thrown when a variant has insufficient stock.
 * Callers can catch this specifically to return 409 vs 500.
 */
class InsufficientStockError extends Error {
  constructor(sku, available, requested) {
    super(`Insufficient stock for SKU "${sku}": available=${available}, requested=${requested}`);
    this.name = 'InsufficientStockError';
    this.sku = sku;
    this.available = available;
    this.requested = requested;
    this.statusCode = 409;
  }
}

/**
 * Atomically deduct stock for one variant.
 *
 * Uses findOneAndUpdate with a stock-check in the query filter — if the
 * document isn't matched (stock too low), it returns null → throws.
 * This is safe against concurrent requests because MongoDB processes the
 * find+update as a single atomic operation at the document level.
 *
 * @param {string}   tenantId
 * @param {string}   productId
 * @param {string}   sku
 * @param {number}   quantity  — must be positive
 * @param {object}   session   — Mongoose ClientSession (for transactions)
 * @returns {object} { product, variant, previousStock, newStock }
 */
const deductOneVariant = async (tenantId, productId, sku, quantity, session) => {
  // First read the current stock so we can record previousStock in the movement log
  const before = await Product.findOne(
    { _id: productId, tenantId, 'variants.sku': sku },
    { 'variants.$': 1 },
    { session }
  ).lean();

  if (!before || !before.variants?.[0]) {
    throw new InsufficientStockError(sku, 0, quantity);
  }

  const previousStock = before.variants[0].stock;

  // Atomic deduction — query includes stock check so it only matches if stock >= quantity
  const updated = await Product.findOneAndUpdate(
    {
      _id: productId,
      tenantId,
      variants: {
        $elemMatch: {
          sku,
          stock: { $gte: quantity }, // ← atomic guard: only matches if enough stock
        },
      },
    },
    { $inc: { 'variants.$.stock': -quantity } },
    { new: true, session }
  );

  if (!updated) {
    // Re-read to report accurate available qty
    const current = await Product.findOne(
      { _id: productId, tenantId, 'variants.sku': sku },
      { 'variants.$': 1 },
      { session }
    ).lean();
    const available = current?.variants?.[0]?.stock ?? 0;
    throw new InsufficientStockError(sku, available, quantity);
  }

  const variant = updated.variants.find((v) => v.sku === sku);
  return { product: updated, variant, previousStock, newStock: variant.stock };
};

/**
 * Atomically add stock for one variant (for PO receipt / return).
 */
const addOneVariant = async (tenantId, productId, sku, quantity, session) => {
  const before = await Product.findOne(
    { _id: productId, tenantId, 'variants.sku': sku },
    { 'variants.$': 1 },
    { session }
  ).lean();

  const previousStock = before?.variants?.[0]?.stock ?? 0;

  const updated = await Product.findOneAndUpdate(
    { _id: productId, tenantId, 'variants.sku': sku },
    { $inc: { 'variants.$.stock': quantity } },
    { new: true, session }
  );

  if (!updated) throw new Error(`Product/variant not found: ${productId}/${sku}`);

  const variant = updated.variants.find((v) => v.sku === sku);
  return { product: updated, variant, previousStock, newStock: variant.stock };
};

/**
 * Deduct stock for multiple items in a single MongoDB transaction.
 * If ANY item fails (insufficient stock), the whole transaction is rolled back.
 *
 * @param {string} tenantId
 * @param {Array}  items  — [{ productId, variantSku, quantity }]
 * @param {object} opts   — { type, reference, referenceId, performedBy }
 * @returns {Array} stockMovements created
 */
const deductStock = async (tenantId, items, opts = {}) => {
  const { type = 'sale', reference = '', referenceId = null, performedBy = null } = opts;

  const session = await mongoose.startSession();
  const movements = [];

  try {
    await session.withTransaction(async () => {
      for (const item of items) {
        const { productId, variantSku, quantity } = item;

        const { previousStock, newStock } = await deductOneVariant(
          tenantId,
          productId,
          variantSku,
          quantity,
          session
        );

        movements.push({
          tenantId,
          productId,
          variantSku,
          type,
          quantity: -quantity, // negative = stock out
          previousStock,
          newStock,
          reference,
          referenceId,
          performedBy,
        });
      }

      // Bulk-insert all movements inside the same transaction
      await StockMovement.insertMany(movements, { session });
    });

    // Emit real-time events AFTER transaction commits
    for (const m of movements) {
      emitToTenant(tenantId.toString(), 'stock:updated', {
        productId: m.productId,
        sku: m.variantSku,
        newStock: m.newStock,
      });

      // Smart alert: check PO coverage before emitting — non-blocking
      getAlertService()
        .notifyLowStockIfNeeded(tenantId, m.productId, m.variantSku, m.newStock, 10)
        .catch(() => {}); // never crash the main flow
    }

    return movements;
  } finally {
    session.endSession();
  }
};

/**
 * Add stock for multiple items in a single MongoDB transaction.
 * Used by PO receive and order returns.
 */
const addStock = async (tenantId, items, opts = {}) => {
  const { type = 'purchase', reference = '', referenceId = null, performedBy = null } = opts;

  const session = await mongoose.startSession();
  const movements = [];

  try {
    await session.withTransaction(async () => {
      for (const item of items) {
        const { productId, variantSku, quantity } = item;

        const { previousStock, newStock } = await addOneVariant(
          tenantId,
          productId,
          variantSku,
          quantity,
          session
        );

        movements.push({
          tenantId,
          productId,
          variantSku,
          type,
          quantity: +quantity, // positive = stock in
          previousStock,
          newStock,
          reference,
          referenceId,
          performedBy,
        });
      }

      await StockMovement.insertMany(movements, { session });
    });

    for (const m of movements) {
      emitToTenant(tenantId.toString(), 'stock:updated', {
        productId: m.productId,
        sku: m.variantSku,
        newStock: m.newStock,
      });
    }

    return movements;
  } finally {
    session.endSession();
  }
};

module.exports = { deductStock, addStock, InsufficientStockError };

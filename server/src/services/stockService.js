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
    this.name      = 'InsufficientStockError';
    this.sku       = sku;
    this.available = available;
    this.requested = requested;
    this.statusCode = 409;
  }
}

/**
 * Atomically deduct stock for one variant (no session required).
 *
 * Uses findOneAndUpdate with a stock-check in the query filter — if the
 * document isn't matched (stock too low), it returns null → throws.
 * MongoDB processes the find+update as a single atomic operation at the
 * document level, so this is safe against concurrent requests.
 */
const deductOneVariant = async (tenantId, productId, sku, quantity) => {
  // Read current stock first so we can record previousStock in the movement log
  const before = await Product.findOne(
    { _id: productId, tenantId, 'variants.sku': sku },
    { 'variants.$': 1 }
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
    { new: true }
  );

  if (!updated) {
    // Re-read to report accurate available qty in the error
    const current = await Product.findOne(
      { _id: productId, tenantId, 'variants.sku': sku },
      { 'variants.$': 1 }
    ).lean();
    const available = current?.variants?.[0]?.stock ?? 0;
    throw new InsufficientStockError(sku, available, quantity);
  }

  const variant = updated.variants.find((v) => v.sku === sku);
  return { product: updated, variant, previousStock, newStock: variant.stock };
};

/**
 * Add stock for one variant (no session required).
 * Adding stock never fails due to a guard condition.
 */
const addOneVariant = async (tenantId, productId, sku, quantity) => {
  const before = await Product.findOne(
    { _id: productId, tenantId, 'variants.sku': sku },
    { 'variants.$': 1 }
  ).lean();

  const previousStock = before?.variants?.[0]?.stock ?? 0;

  const updated = await Product.findOneAndUpdate(
    { _id: productId, tenantId, 'variants.sku': sku },
    { $inc: { 'variants.$.stock': quantity } },
    { new: true }
  );

  if (!updated) throw new Error(`Product/variant not found: ${productId}/${sku}`);

  const variant = updated.variants.find((v) => v.sku === sku);
  return { product: updated, variant, previousStock, newStock: variant.stock };
};

/**
 * Deduct stock for multiple items.
 *
 * HOW CONCURRENCY IS HANDLED:
 *   Each item uses findOneAndUpdate with $elemMatch { stock: { $gte: qty } }.
 *   If two requests arrive simultaneously for the last unit:
 *     • First:  matches (stock=1 >= 1), decrements → stock=0. ✓
 *     • Second: no match (stock=0 >= 1 is false) → InsufficientStockError → 409.
 *   Result: exactly one succeeds.
 *
 * MULTI-ITEM ROLLBACK:
 *   If item N fails, items 0..N-1 are already deducted. We roll them back
 *   by adding the quantity back before re-throwing, so stock is never left
 *   in a partial state.
 *
 * NOTE: MongoDB multi-document transactions (session.withTransaction) are
 * not supported on Atlas M0/M2/M5 shared tiers. This session-free approach
 * uses document-level atomicity which works on all tiers.
 *
 * @param {ObjectId} tenantId
 * @param {Array}    items  — [{ productId, variantSku, quantity }]
 * @param {object}   opts   — { type, reference, referenceId, performedBy }
 * @returns {Array}  StockMovement documents created
 */
const deductStock = async (tenantId, items, opts = {}) => {
  const { type = 'sale', reference = '', referenceId = null, performedBy = null } = opts;

  const completed = []; // track which items were successfully deducted for rollback

  try {
    for (const item of items) {
      const { productId, variantSku, quantity } = item;
      const result = await deductOneVariant(tenantId, productId, variantSku, quantity);
      completed.push({ productId, variantSku, quantity, ...result });
    }
  } catch (err) {
    // Roll back all successfully deducted items before re-throwing
    for (const done of completed) {
      await addOneVariant(tenantId, done.productId, done.variantSku, done.quantity)
        .catch(() => {}); // best-effort rollback — never mask the original error
    }
    throw err;
  }

  // All items deducted — now write movement records and emit events
  const movementDocs = completed.map(({ productId, variantSku, quantity, previousStock, newStock }) => ({
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
  }));

  await StockMovement.insertMany(movementDocs);

  // Emit real-time events
  for (const m of movementDocs) {
    emitToTenant(tenantId.toString(), 'stock:updated', {
      productId: m.productId,
      sku:       m.variantSku,
      newStock:  m.newStock,
    });

    // Smart alert: check PO coverage before emitting — non-blocking
    getAlertService()
      .notifyLowStockIfNeeded(tenantId, m.productId, m.variantSku, m.newStock, 10)
      .catch(() => {}); // never crash the main flow
  }

  return movementDocs;
};

/**
 * Add stock for multiple items.
 * Used by PO receive and order cancellation (stock return).
 *
 * @param {ObjectId} tenantId
 * @param {Array}    items  — [{ productId, variantSku, quantity }]
 * @param {object}   opts   — { type, reference, referenceId, performedBy }
 * @returns {Array}  StockMovement documents created
 */
const addStock = async (tenantId, items, opts = {}) => {
  const { type = 'purchase', reference = '', referenceId = null, performedBy = null } = opts;

  const completed = [];

  for (const item of items) {
    const { productId, variantSku, quantity } = item;
    const result = await addOneVariant(tenantId, productId, variantSku, quantity);
    completed.push({ productId, variantSku, quantity, ...result });
  }

  const movementDocs = completed.map(({ productId, variantSku, quantity, previousStock, newStock }) => ({
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
  }));

  await StockMovement.insertMany(movementDocs);

  for (const m of movementDocs) {
    emitToTenant(tenantId.toString(), 'stock:updated', {
      productId: m.productId,
      sku:       m.variantSku,
      newStock:  m.newStock,
    });
  }

  return movementDocs;
};

module.exports = { deductStock, addStock, InsufficientStockError };

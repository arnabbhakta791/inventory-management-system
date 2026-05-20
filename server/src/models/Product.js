const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true },
    attributes: { type: Map, of: String, default: {} }, // e.g. { size: "M", color: "Red" }
    stock: { type: Number, required: true, default: 0, min: 0 },
    reservedStock: { type: Number, default: 0, min: 0 }, // stock reserved by pending orders
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
  },
  { _id: false } // embedded, no separate _id
);

const productSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, required: true, trim: true },
    brand: { type: String, trim: true, default: '' },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    // Variant dimension names e.g. ["size", "color"]
    // Empty array means product has a single default variant
    attributes: { type: [String], default: [] },
    variants: { type: [variantSchema], required: true },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// --- Indexes ---
productSchema.index({ tenantId: 1 });
productSchema.index({ tenantId: 1, category: 1 });
productSchema.index({ tenantId: 1, isActive: 1 });
productSchema.index({ tenantId: 1, 'variants.sku': 1 });
productSchema.index({ tenantId: 1, supplierId: 1 });
// Text index for search
productSchema.index({ name: 'text', brand: 'text', category: 'text', tags: 'text' });

// --- Virtual: total stock across all variants ---
productSchema.virtual('totalStock').get(function () {
  return this.variants.reduce((sum, v) => sum + v.stock, 0);
});

// --- Pre-save: ensure SKUs are unique within the product ---
productSchema.pre('save', function (next) {
  const skus = this.variants.map((v) => v.sku);
  const uniqueSkus = new Set(skus);
  if (skus.length !== uniqueSkus.size) {
    return next(new Error('Duplicate SKU found in variants'));
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);

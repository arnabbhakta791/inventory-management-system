const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String, required: true },
    type: {
      type: String,
      enum: ['purchase', 'sale', 'return', 'adjustment'],
      required: true,
    },
    // Positive = stock in, negative = stock out
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    // Reference to the source document (PO number, Order number, etc.)
    reference: { type: String, default: '' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    notes: { type: String, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    // Movements are append-only — disable updates
  }
);

// Indexes for dashboard aggregations and audit log queries
stockMovementSchema.index({ tenantId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, variantSku: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);

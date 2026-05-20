const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku:       { type: String, required: true },
    productName:      { type: String, required: true },   // denormalized for display
    quantity:         { type: Number, required: true, min: 1 },
    unitPrice:        { type: Number, required: true, min: 0 },
    fulfilledQuantity:{ type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status:    { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes:     { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    tenantId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    orderNumber:   { type: String, required: true },   // ORD-{SLUG}-{YYMMDD}-{RAND}
    customerName:  { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true, default: '' },
    customerPhone: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'partially_fulfilled'],
      default: 'pending',
    },
    items:         { type: [orderItemSchema], required: true },
    totalAmount:   { type: Number, required: true, min: 0 },
    notes:         { type: String, default: '' },
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
    // Timestamps for key events
    confirmedAt:   { type: Date, default: null },
    shippedAt:     { type: Date, default: null },
    deliveredAt:   { type: Date, default: null },
    cancelledAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound indexes for queries and dashboard aggregations
orderSchema.index({ tenantId: 1, status: 1 });
orderSchema.index({ tenantId: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, customerName: 1 });
// For top-sellers aggregation: join with StockMovement on type:sale + createdAt range
orderSchema.index({ tenantId: 1, 'items.variantSku': 1 });

module.exports = mongoose.model('Order', orderSchema);

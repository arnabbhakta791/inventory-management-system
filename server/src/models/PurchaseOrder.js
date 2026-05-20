const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String, required: true },
    productName: { type: String, required: true }, // denormalized for display
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    receivedAt: { type: Date, default: null },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    orderNumber: { type: String, required: true }, // PO-{slug}-{timestamp}
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'confirmed', 'received', 'partially_received', 'cancelled'],
      default: 'draft',
    },
    items: { type: [poItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    expectedDeliveryDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
    sentAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ tenantId: 1, status: 1 });
purchaseOrderSchema.index({ tenantId: 1, createdAt: -1 });
purchaseOrderSchema.index({ tenantId: 1, supplierId: 1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);

const mongoose = require('mongoose');

const supplierProductSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    defaultUnitPrice: { type: Number, min: 0, default: 0 },
    leadTimeDays: { type: Number, min: 0, default: 7 },
  },
  { _id: false }
);

const supplierSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
    address: {
      street: { type: String, default: '' },
      city:   { type: String, default: '' },
      state:  { type: String, default: '' },
      zip:    { type: String, default: '' },
      country:{ type: String, default: '' },
    },
    // Products this supplier can provide, with pricing info
    products: { type: [supplierProductSchema], default: [] },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index({ tenantId: 1 });
supplierSchema.index({ tenantId: 1, isActive: 1 });
supplierSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);

const express = require('express');
const { body } = require('express-validator');
const {
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  updatePurchaseOrder, updateStatus, receivePurchaseOrder, cancelPurchaseOrder,
} = require('../controllers/purchaseOrderController');
const { protect } = require('../middleware/auth');
const { managerOrAbove } = require('../middleware/rbac');

const router = express.Router();
router.use(protect);

const poValidation = [
  body('supplierId').notEmpty().withMessage('Supplier is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').notEmpty().withMessage('Product ID required on each item'),
  body('items.*.variantSku').notEmpty().withMessage('Variant SKU required on each item'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be >= 0'),
];

router.route('/')
  .get(getPurchaseOrders)
  .post(managerOrAbove, poValidation, createPurchaseOrder);

router.route('/:id')
  .get(getPurchaseOrder)
  .put(managerOrAbove, updatePurchaseOrder)
  .delete(managerOrAbove, cancelPurchaseOrder);

router.patch('/:id/status',  managerOrAbove, updateStatus);
router.post('/:id/receive',  managerOrAbove, receivePurchaseOrder);

module.exports = router;

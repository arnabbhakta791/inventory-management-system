const express = require('express');
const { body } = require('express-validator');
const {
  getOrders, getOrder, createOrder, updateOrderStatus, cancelOrder, fulfillOrder,
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { managerOrAbove } = require('../middleware/rbac');

const router = express.Router();
router.use(protect);

const orderValidation = [
  body('customerName').notEmpty().withMessage('Customer name is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').notEmpty().withMessage('Product ID required on each item'),
  body('items.*.variantSku').notEmpty().withMessage('Variant SKU required on each item'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

router.route('/')
  .get(getOrders)
  .post(orderValidation, createOrder);

router.route('/:id')
  .get(getOrder);

router.patch('/:id/status',  managerOrAbove, updateOrderStatus);
router.post('/:id/cancel',   managerOrAbove, cancelOrder);
router.post('/:id/fulfill',  managerOrAbove, fulfillOrder);

module.exports = router;
